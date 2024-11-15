import { HandlerContext, SkillResponse } from "@xmtp/message-kit";

export async function handleAccounts(context: HandlerContext): Promise<SkillResponse | undefined> {
	const {
		message: {
			sender,
			content: { skill, params },
		},
	} = context;

	switch (skill) {
		case "create-account":
			return { code: 200, message: "account created" };
		default:
			return { code: 400, message: "Skill not found" };
	}
}
