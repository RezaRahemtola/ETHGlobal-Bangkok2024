import { z } from "zod";
import { importAccountFromPrivateKey } from "@aleph-sdk/ethereum";
import env from "../config/env.js";
import { AuthenticatedAlephHttpClient } from "@aleph-sdk/client";

const userAccountSchema = z.object({
	name: z.string(),
	chain: z.union([z.literal("ethereum"), z.literal("bitcoin")]),
	address: z.string(),
});
export type UserAccount = z.infer<typeof userAccountSchema>;
const userAccountsSchema = z.array(userAccountSchema);

const storageSchema = z.record(z.string(), userAccountsSchema);
export type UserAccountsStorage = z.infer<typeof storageSchema>;

const ALEPH_KEY = "ETHGlobal-Bangkok2024";

export const getUserAccounts = async (): Promise<UserAccountsStorage> => {
	const alephAccount = importAccountFromPrivateKey(env.AGENT_WALLET_PRIVATE_KEY);
	const client = new AuthenticatedAlephHttpClient(alephAccount, env.ALEPH_API_URL);

	try {
		const result = await client.fetchAggregate(env.AGENT_WALLET_ADDRESS, ALEPH_KEY);
		const parsedResult = storageSchema.parse(result);
		return parsedResult;
	} catch (error) {
		console.error(`Error fetching user accounts from Aleph: ${error}`);
	}
	return {};
};

export const updateUserAccounts = async (userAccounts: UserAccountsStorage) => {
	const alephAccount = importAccountFromPrivateKey(env.AGENT_WALLET_PRIVATE_KEY);
	const client = new AuthenticatedAlephHttpClient(alephAccount, env.ALEPH_API_URL);

	try {
		await client.createAggregate({ address: env.AGENT_WALLET_ADDRESS, key: ALEPH_KEY, content: userAccounts });
	} catch (error) {
		console.error(`Error uploading user accounts to Aleph: ${error}`);
	}
};
