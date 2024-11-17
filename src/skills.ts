import type { SkillGroup } from "@xmtp/message-kit";
import { handleAccounts } from "./handler/accounts.js";

export const skills: SkillGroup[] = [
	{
		name: "AIlice - Blockchain accounts management agent",
		tag: "@ailice",
		description: "Create accounts on different blockchains and interact with them.",
		skills: [
			{
				skill: "/create-account [blockchain] [name] [password]",
				handler: handleAccounts,
				description: "Create a new account/wallet on the specified blockchain using a given password.",
				examples: [
					"/create-account ethereum cold_wallet supersecretpassword",
					"/create-account bitcoin hot_wallet othermasterkey",
				],
				params: {
					blockchain: {
						type: "string",
						values: ["ethereum", "bitcoin"],
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
			{
				skill: "/get-main-asset-balance [accountName]",
				handler: handleAccounts,
				description: "Get the balance of the main asset of a blockchain account",
				examples: ["/get-main-asset-balance my_account", "/get-main-asset-balance somebody"],
				params: {
					accountName: {
						type: "string",
					},
				},
			},
			{
				skill: "/get-main-asset-total-balances",
				handler: handleAccounts,
				description: "Get the total balances of all the user's blockchain accounts combined.",
				examples: ["/get-main-asset-total-balances"],
				params: {},
			},
			{
				skill: "/rename-account [oldName] [newName]",
				handler: handleAccounts,
				description: "Rename an existing blockchain account",
				examples: ["/rename-account something other", "/rename-account cold hot"],
				params: {
					oldName: {
						type: "string",
					},
					newName: {
						type: "string",
					},
				},
			},
			{
				skill: "/delete-account [name]",
				handler: handleAccounts,
				description: "Delete an existing blockchain account",
				examples: ["/delete-account bitconnect", "/delete-account my_noob_account"],
				params: {
					name: {
						type: "string",
					},
				},
			},
		],
	},
];
