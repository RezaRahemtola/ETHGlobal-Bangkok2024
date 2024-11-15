import { KeyPairString } from "near-api-js/lib/utils/key_pair.js";
import env from "../config/env.js";
import { generateAddress } from "./kdf.js";
import { generatePath } from "./path.js";
import * as nearAPI from "near-api-js";

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

export const genNearAccount = async (path: string): Promise<string> => {
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
		await createAccountWithSecpKey({
			accountId: accountId!,
			secretKey: nearImplicitSecretKey as KeyPairString,
			keyToAdd: nearSecpPublicKey!,
		});
	}

	return accountId!;
};

const getKeys = async (accountId: string) => {
	const account = new Account(near.connection, accountId);
	return await account.getAccessKeys();
};

export const createAccountWithSecpKey = async ({
	accountId: newAccountId,
	secretKey,
	keyToAdd,
}: {
	accountId: string;
	secretKey: KeyPairString;
	keyToAdd: string;
}) => {
	const account = new Account(near.connection, env.NEAR_ACCOUNT_ID);
	await account.sendMoney(newAccountId, BigInt("5000000000000000000000000"));
	const keyPair = KeyPair.fromString(secretKey);
	keyStore.setKey(networkId, newAccountId, keyPair);
	const newAccount = new Account(near.connection, newAccountId);
	await newAccount.addKey(keyToAdd);
};
