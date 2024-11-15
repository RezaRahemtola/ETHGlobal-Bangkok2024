import { z } from "zod";

const envSchema = z.object({
	AGENT_WALLET_ADDRESS: z.string(),
	AGENT_WALLET_PRIVATE_KEY: z.string(),
	KEY: z.string(),
	OPEN_AI_API_KEY: z.string(),
	NEAR_ACCOUNT_ID: z.string(),
	NEAR_PRIVATE_KEY: z.string(),
	MPC_CONTRACT_ID: z.string(),
	MPC_PUBLIC_KEY: z.string(),
});

const env = envSchema.parse(process.env);

export default env;
