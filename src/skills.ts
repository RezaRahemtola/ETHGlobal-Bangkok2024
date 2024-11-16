import type { SkillGroup } from "@xmtp/message-kit";
import { handleAccounts } from "./handler/accounts.js";

export const skills: SkillGroup[] = [
	{
		name: "Blockchain accounts management bot",
		tag: "@accounts",
		description: "Create accounts on different blockchains and interact with them.",
		skills: [
			{
				skill: "/create-account [blockchain] [name] [password]",
				handler: handleAccounts,
				description: "Create a new account/wallet on the specified blockchain using a given password.",
				examples: ["/create-account ethereum cold_wallet supersecretpassword"],
				params: {
					blockchain: {
						type: "string",
						values: ["ethereum"],
					},
					name: {
						type: "string",
					},
					password: {
						type: "string",
					},
				},
			},
			{
				skill: "/list-accounts",
				handler: handleAccounts,
				description: "List all the blockchain accounts previously created.",
				examples: ["/list-accounts"],
				params: {},
			},
			{
				skill: "/send-main-asset [amount] [destination] [account] [password]",
				handler: handleAccounts,
				description: "Send a given amount of the main asset from a blockchain account",
				examples: [
					"/send-main-asset 1 0xd8da6bf26964af9d7eed9e03e53415d37aa96045 my_account_name supersecretpassword",
					"/send-main-asset 0.034 0x6719a70e3b9652d0cd3d4cd28a93556497e2bf96 other_acc loregt",
				],
				params: {
					amount: {
						type: "number",
						default: 0.02,
					},
					destination: {
						type: "address",
						default: "0x7Ab98f6b22ECb42E27Dc9C7d2d488F69b5CDD0b2",
					},
					account: {
						type: "string",
					},
					password: {
						type: "string",
					},
				},
			},
			// {
			// 	skill: "/register [domain]",
			// 	handler: handleEns,
			// 	description: "Register a new ENS domain. Returns a URL to complete the registration process.",
			// 	examples: ["/register vitalik.eth"],
			// 	params: {
			// 		domain: {
			// 			type: "string",
			// 		},
			// 	},
			// },
			// {
			// 	skill: "/info [domain]",
			// 	handler: handleEns,
			// 	description: "Get detailed information about an ENS domain including owner, expiry date, and resolver.",
			// 	examples: ["/info nick.eth"],
			// 	params: {
			// 		domain: {
			// 			type: "string",
			// 		},
			// 	},
			// },
			// {
			// 	skill: "/renew [domain]",
			// 	handler: handleEns,
			// 	description: "Extend the registration period of your ENS domain. Returns a URL to complete the renewal.",
			// 	examples: ["/renew fabri.base.eth"],
			// 	params: {
			// 		domain: {
			// 			type: "string",
			// 		},
			// 	},
			// },
			// {
			// 	skill: "/check [domain]",
			// 	handler: handleEns,
			// 	examples: ["/check vitalik.eth", "/check fabri.base.eth"],
			// 	description: "Check if a domain is available.",
			// 	params: {
			// 		domain: {
			// 			type: "string",
			// 		},
			// 	},
			// },
			// {
			// 	skill: "/cool [domain]",
			// 	examples: ["/cool vitalik.eth"],
			// 	handler: handleEns,
			// 	description: "Get cool alternatives for a .eth domain.",
			// 	params: {
			// 		domain: {
			// 			type: "string",
			// 		},
			// 	},
			// },
			// {
			// 	skill: "/reset",
			// 	examples: ["/reset"],
			// 	handler: handleEns,
			// 	description: "Reset the conversation.",
			// 	params: {},
			// },
			// {
			// 	skill: "/tip [address]",
			// 	description: "Show a URL for tipping a domain owner.",
			// 	handler: handleEns,
			// 	examples: ["/tip 0x1234567890123456789012345678901234567890"],
			// 	params: {
			// 		address: {
			// 			type: "string",
			// 		},
			// 	},
			// },
		],
	},
];
