import { ethers } from "ethers";
import { fetchJson } from "./utils.js";
import { sign } from "./near.js";
import * as bitcoinJs from "bitcoinjs-lib";
import { Account } from "near-api-js";

const bitcoin = {
	name: "Bitcoin Testnet",
	currency: "sats",
	explorer: "https://blockstream.info/testnet",
	rpc: `https://blockstream.info/testnet/api`,

	getBalance: async ({ address, getUtxos = false }: { address: string; getUtxos?: boolean }) => {
		const res = (await fetchJson(`https://blockstream.info/testnet/api/address/${address}/utxo`)) as unknown as any;

		let utxos = res.map((utxo: any) => ({
			txid: utxo.txid,
			vout: utxo.vout,
			value: utxo.value,
		}));
		// ONLY RETURNING AND SIGNING LARGEST UTXO
		// WHY?
		// For convenience in client side, this will only require 1 Near signature for 1 Bitcoin TX.
		// Solutions for signing multiple UTXOs using MPC with a single Near TX are being worked on.
		let maxValue = 0;
		utxos.forEach((utxo: any) => {
			if (utxo.value > maxValue) maxValue = utxo.value;
		});
		utxos = utxos.filter((utxo: any) => utxo.value === maxValue);

		if (!utxos || !utxos.length) {
			console.log("no utxos for address", address, "please fund address and try again");
		}

		return getUtxos ? utxos : maxValue;
	},
	send: async ({
		from: address,
		publicKey,
		to,
		amount = "1",
		path,
		nearAccount,
	}: {
		from: string;
		publicKey: string;
		to: string;
		amount?: string;
		path: string;
		nearAccount: Account;
	}): Promise<{ error?: string; result?: string }> => {
		const { getBalance, explorer, currency } = bitcoin;
		const sats = parseInt(amount);

		// get utxos
		const utxos = await getBalance({ address, getUtxos: true });

		// check balance (TODO include fee in check)
		console.log("balance", utxos[0].value, currency);
		if (utxos[0].value < sats) {
			return { error: "Insufficient funds" };
		}
		console.log("sending", amount, currency, "from", address, "to", to);

		const psbt = new bitcoinJs.Psbt({
			network: bitcoinJs.networks.testnet,
		});

		let totalInput = 0;
		await Promise.all(
			utxos.map(async (utxo: any) => {
				totalInput += utxo.value;

				const transaction = await fetchTransaction(utxo.txid);
				let inputOptions;
				if (transaction.outs[utxo.vout].script.includes("0014" as unknown as number)) {
					inputOptions = {
						hash: utxo.txid,
						index: utxo.vout,
						witnessUtxo: {
							script: transaction.outs[utxo.vout].script,
							value: utxo.value,
						},
					};
				} else {
					inputOptions = {
						hash: utxo.txid,
						index: utxo.vout,
						nonWitnessUtxo: Buffer.from(transaction.toHex(), "hex"),
					};
				}
				psbt.addInput(inputOptions);
			}),
		);

		psbt.addOutput({
			address: to,
			value: sats as unknown as bigint,
		});

		// calculate fee
		const feeRate = await fetchJson(`${bitcoin.rpc}/fee-estimates`);
		const estimatedSize = utxos.length * 148 + 2 * 34 + 10;
		// @ts-ignore
		const fee = estimatedSize * (feeRate[6] + 3);
		console.log("btc fee", fee);
		const change = totalInput - sats - fee;
		console.log("change leftover", change);
		if (change > 0) {
			psbt.addOutput({
				address: address,
				value: change as unknown as bigint,
			});
		}

		// keyPair object required by psbt.signInputAsync(index, keyPair)
		const keyPair = {
			publicKey: Buffer.from(publicKey, "hex"),
			sign: async (transactionHash: any) => {
				const payload = Object.values(ethers.utils.arrayify(transactionHash));
				const sig: any = await sign(payload, path, nearAccount);
				if (!sig) return;
				return Buffer.from(sig.r + sig.s, "hex");
			},
		};

		await Promise.all(
			utxos.map(async (_: any, index: number) => {
				try {
					await psbt.signInputAsync(index, keyPair as unknown as any);
				} catch (e) {
					console.warn("not signed");
				}
			}),
		);

		psbt.finalizeAllInputs();

		// broadcast tx
		try {
			const res = await fetch(`https://corsproxy.io/?${bitcoin.rpc}/tx`, {
				method: "POST",
				body: psbt.extractTransaction().toHex(),
			});
			if (res.status === 200) {
				const hash = await res.text();
				console.log("tx hash", hash);
				console.log("explorer link", `${explorer}/tx/${hash}`);
				console.log("NOTE: it might take a minute for transaction to be included in mempool");
				return { result: hash };
			} else {
				return { error: `Proxy returned ${res.status} code` };
			}
		} catch (e) {
			console.log("error broadcasting bitcoin tx", JSON.stringify(e));
			return { error: JSON.stringify(e) };
		}
	},
};

export default bitcoin;

async function fetchTransaction(transactionId: any): Promise<bitcoinJs.Transaction> {
	const data = (await fetchJson(`${bitcoin.rpc}/tx/${transactionId}`)) as unknown as any;
	const tx = new bitcoinJs.Transaction();

	// console.log('bitcoin transaction', tx);

	tx.version = data.version;
	tx.locktime = data.locktime;

	data.vin.forEach((vin: any) => {
		const txHash = Buffer.from(vin.txid, "hex").reverse();
		const vout = vin.vout;
		const sequence = vin.sequence;
		const scriptSig = vin.scriptsig ? Buffer.from(vin.scriptsig, "hex") : undefined;
		tx.addInput(txHash, vout, sequence, scriptSig);
	});

	data.vout.forEach((vout: any) => {
		const value = vout.value;
		const scriptPubKey = Buffer.from(vout.scriptpubkey, "hex");
		tx.addOutput(scriptPubKey, value);
	});

	data.vin.forEach((vin: any, index: number) => {
		if (vin.witness && vin.witness.length > 0) {
			const witness = vin.witness.map((w: any) => Buffer.from(w, "hex"));
			tx.setWitness(index, witness);
		}
	});

	return tx;
}
