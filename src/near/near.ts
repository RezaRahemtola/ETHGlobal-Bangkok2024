import { KeyPairString } from "near-api-js/lib/utils/key_pair.js";
import env from "../config/env.js";
import { generateAddress } from "./kdf.js";
import { generatePath } from "./path.js";
import * as nearAPI from "near-api-js";
import BN from "bn.js";

const { Near, Account, keyStores, KeyPair } = nearAPI;

const privateKey = env.NEAR_PRIVATE_KEY;
const keyStore = new keyStores.InMemoryKeyStore();
const networkId = "testnet";
keyStore.setKey("testnet", env.NEAR_ACCOUNT_ID, KeyPair.fromString(privateKey as KeyPairString));
const config = {
	networkId: "testnet",
	keyStore: keyStore,
	nodeUrl: "https://rpc.testnet.near.org",
	walletUrl: "https://testnet.mynearwallet.com/",
	helperUrl: "https://helper.testnet.near.org",
	explorerUrl: "https://testnet.nearblocks.io",
};
const near = new Near(config);

export const genAddress = async (userAddress: string, chain: string, password: string, accountId: string) => {
	const path = await generatePath(userAddress, password);

	return generateAddress({
		publicKey: env.MPC_PUBLIC_KEY,
		accountId,
		path,
		chain,
	});
};

export const genNearAccount = async (path: string): Promise<nearAPI.Account> => {
	const {
		address: accountId,
		nearSecpPublicKey,
		nearImplicitSecretKey,
	} = await generateAddress({
		publicKey: env.MPC_PUBLIC_KEY,
		accountId: env.MPC_CONTRACT_ID, // TODO: check if the same because it wasn't in the example
		path,
		chain: "near",
	});

	console.log("implicit accountId", accountId);
	console.log("nearSecpPublicKey", nearSecpPublicKey);

	// update default tx to sign with the latest information
	let accessKeys = await getKeys(accountId!);
	if (accessKeys.length === 0) {
		console.log("Creating NEAR Account");
		return await createAccountWithSecpKey({
			accountId: accountId!,
			secretKey: nearImplicitSecretKey as KeyPairString,
			keyToAdd: nearSecpPublicKey!,
			fund: true,
		});
	}

	return await createAccountWithSecpKey({
		accountId: accountId!,
		secretKey: nearImplicitSecretKey as KeyPairString,
		keyToAdd: nearSecpPublicKey!,
		fund: false,
	});
};

const getKeys = async (accountId: string) => {
	const account = new Account(near.connection, accountId);
	return await account.getAccessKeys();
};

export const createAccountWithSecpKey = async ({
	accountId: newAccountId,
	secretKey,
	keyToAdd,
	fund,
}: {
	accountId: string;
	secretKey: KeyPairString;
	keyToAdd: string;
	fund: boolean;
}): Promise<nearAPI.Account> => {
	const keyPair = KeyPair.fromString(secretKey);
	keyStore.setKey(networkId, newAccountId, keyPair);
	const newAccount = new Account(near.connection, newAccountId);

	if (fund) {
		// Dev account
		const account = new Account(near.connection, env.NEAR_ACCOUNT_ID);
		// Funding the user wallet with some money
		await account.sendMoney(newAccountId, BigInt("5000000000000000000000000"));
		await newAccount.addKey(keyToAdd);
	}

	return newAccount;
};

export async function sign(payload: any, path: string, account: nearAPI.Account) {
	const args = {
		request: {
			payload,
			path,
			key_version: 0,
		},
	};
	let attachedDeposit = nearAPI.utils.format.parseNearAmount("0.2");

	console.log("sign payload", payload.length > 200 ? payload.length : payload.toString());
	console.log("with path", path);
	console.log("this may take approx. 30 seconds to complete");
	console.log("argument to sign: ", args);

	let res: nearAPI.providers.FinalExecutionOutcome;
	try {
		res = await account.functionCall({
			contractId: env.MPC_CONTRACT_ID,
			methodName: "sign",
			args,
			gas: new BN("290000000000000") as unknown as never,
			attachedDeposit: new BN(attachedDeposit as unknown as never) as unknown as never,
		});
		console.log(res);
	} catch (e) {
		console.error(e);
		throw new Error(`error signing ${JSON.stringify(e)}`);
	}

	// parse result into signature values we need r, s but we don't need first 2 bytes of r (y-parity)
	if ("SuccessValue" in (res.status as any)) {
		const successValue = (res.status as any).SuccessValue;
		const decodedValue = Buffer.from(successValue, "base64").toString();
		console.log("decoded value: ", decodedValue);
		const { big_r, s: S, recovery_id } = JSON.parse(decodedValue);
		const r = Buffer.from(big_r.affine_point.substring(2), "hex");
		const s = Buffer.from(S.scalar, "hex");

		return {
			r,
			s,
			v: recovery_id,
		};
	} else {
		throw new Error(`error signing ${JSON.stringify(res)}`);
	}
}
