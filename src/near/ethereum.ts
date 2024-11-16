import { ethers } from "ethers";
import BN from "bn.js";
import { fetchJson } from "./utils.js";
import { sign } from "./near.js";
import { Account } from "near-api-js";

const ethereum = {
	name: "Sepolia",
	chainId: 11155111,
	currency: "ETH",
	explorer: "https://eth-sepolia.blockscout.com",
	gasLimit: 21000,

	getGasPrice: async () => {
		// get current gas prices on Sepolia
		const {
			data: { rapid, fast, standard },
		} = (await fetchJson(`https://sepolia.beaconcha.in/api/v1/execution/gasnow`)) as unknown as never;
		let gasPrice = Math.max(rapid, fast, standard);
		if (!gasPrice) {
			console.log("Unable to get gas price. Please refresh and try again.");
		}
		return Math.max(rapid, fast, standard);
	},

	getBalance: async (address: string) => {
		try {
			return await getSepoliaProvider().getBalance(address);
		} catch (_) {
			return 0;
		}
	},

	send: async ({
		from: address,
		to,
		amount = "0.001",
		path,
		nearAccount,
	}: {
		from: string;
		to: string;
		amount?: string;
		path: string;
		nearAccount: Account;
	}): Promise<{ error?: string; result?: string }> => {
		const { getGasPrice, gasLimit, chainId, getBalance, completeEthereumTx, currency } = ethereum;

		const balance = await getBalance(address);
		console.log("balance", ethers.utils.formatUnits(balance), currency);

		const provider = getSepoliaProvider();
		// get the nonce for the sender
		const nonce = await provider.getTransactionCount(address);
		const gasPrice = await getGasPrice();

		// check sending value
		const value = ethers.utils.hexlify(ethers.utils.parseUnits(amount));
		if (value === "0x00") {
			console.log("Amount is zero. Please try a non-zero amount.");
			return { error: "Amount is zero. Please try a non-zero amount." };
		}

		// check account has enough balance to cover value + gas spend
		const overrideBalanceCheck = false;
		if (
			!overrideBalanceCheck &&
			(!balance ||
				new BN(balance.toString()).lt(
					new BN(ethers.utils.parseUnits(amount).toString()).add(new BN(gasPrice).mul(new BN(gasLimit.toString()))),
				))
		) {
			return { error: "insufficient funds" };
		}

		console.log("sending", amount, currency, "from", address, "to", to);

		const baseTx = {
			to,
			nonce,
			data: [],
			value,
			gasLimit,
			gasPrice,
			chainId,
		};

		console.log(`baseTx: `, baseTx);

		const { error, result } = await completeEthereumTx({ address, baseTx, path, nearAccount });
		return { error, result };
	},

	completeEthereumTx: async ({
		address,
		baseTx,
		path,
		nearAccount,
	}: {
		address: string;
		baseTx: any;
		path: string;
		nearAccount: Account;
	}): Promise<{ error?: string; result?: string }> => {
		const { chainId, explorer } = ethereum;

		// create hash of unsigned TX to sign -> payload
		const unsignedTx = ethers.utils.serializeTransaction(baseTx);
		const txHash = ethers.utils.keccak256(unsignedTx);
		const payload = Object.values(ethers.utils.arrayify(txHash));

		// get signature from MPC contract
		let sig = (await sign(payload, path, nearAccount)) as unknown as any;

		if (!sig) return { error: "Signature failed" };

		sig.r = "0x" + sig.r.toString("hex");
		sig.s = "0x" + sig.s.toString("hex");
		// console.log('sig', sig);

		// check 2 values for v (y-parity) and recover the same ethereum address from the generateAddress call (in app.ts)
		let addressRecovered = false;
		for (let v = 0; v < 2; v++) {
			sig.v = v + chainId * 2 + 35;
			const recoveredAddress = ethers.utils.recoverAddress(payload, sig);
			if (recoveredAddress.toLowerCase() === address.toLowerCase()) {
				addressRecovered = true;
				break;
			}
		}
		if (!addressRecovered) {
			return { error: "signature failed to recover correct sending address" };
		}

		// broadcast TX - signature now has correct { r, s, v }
		try {
			const hash = await getSepoliaProvider().send("eth_sendRawTransaction", [
				ethers.utils.serializeTransaction(baseTx, sig),
			]);
			console.log("tx hash", hash);
			console.log("explorer link", `${explorer}/tx/${hash}`);
			return { result: hash };
		} catch (e) {
			if (/nonce too low/gi.test(JSON.stringify(e))) {
				return { error: "tx has been tried" };
			}
			if (/gas too low|underpriced/gi.test(JSON.stringify(e))) {
				return { error: e as unknown as any };
			}
			return { error: e as unknown as any };
		}
	},
};

const getSepoliaProvider = () => {
	return new ethers.providers.JsonRpcProvider("https://eth-sepolia.blockscout.com/api/eth-rpc");
};

export default ethereum;
