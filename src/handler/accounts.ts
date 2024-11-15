import { HandlerContext, SkillResponse } from "@xmtp/message-kit";
import { genAddress } from "../near/near.js";

const BLOCKSCOUT_URL_ETH_ADDRESS = "https://eth.blockscout.com/address/";

export async function handleAccounts(context: HandlerContext): Promise<SkillResponse | undefined> {
	const {
		message: {
			sender,
			content: { skill, params },
		},
	} = context;

	switch (skill) {
		case "create-account":
			const { blockchain, password } = params;

			const account = await genAddress(sender.address, blockchain, password);
			return {
				code: 200,
				message: `Account created with address ${account.address} and public key ${account.publicKey}.\n\nView it on the explorer: ${BLOCKSCOUT_URL_ETH_ADDRESS}${account.address}`,
			};
		default:
			return { code: 400, message: "Skill not found" };
	}
}
