import env from "../config/env.js";
import { generateAddress } from "./kdf.js";
import { generatePath } from "./path.js";

export const genAddress = async (userAddress: string, chain: string, password: string) => {
	const path = await generatePath(userAddress, password);
	const accountId = env.NEAR_ACCOUNT_ID;

	return generateAddress({
		publicKey: env.MPC_PUBLIC_KEY,
		accountId,
		path,
		chain,
	});
};
