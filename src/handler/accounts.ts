import { HandlerContext, SkillResponse } from "@xmtp/message-kit";
import { genAddress, genNearAccount } from "../near/near.js";
import { getUserAccounts, updateUserAccounts } from "../aleph/aleph.js";
import ethereum from "../near/ethereum.js";
import { Account } from "near-api-js";
import { generatePath } from "../near/path.js";
import bitcoin from "../near/bitcoin.js";
import { ethers } from "ethers";

const explorers: Record<"bitcoin" | "ethereum", string> = {
	ethereum: "https://eth-sepolia.blockscout.com",
	bitcoin: "https://blockstream.info/testnet",
};

export async function handleAccounts(context: HandlerContext): Promise<SkillResponse> {
	const {
		message: {
			sender,
			content: { skill },
		},
	} = context;

	// Generating Near account (create it if needed)
	const account = await genNearAccount(sender.address.toLowerCase());

	switch (skill) {
		case "create-account":
			return createAccount(context, account.accountId);
		case "list-accounts":
			return listAccounts(context);
		case "send-main-asset":
			return sendMainAsset(context, account);
		case "rename-account":
			return renameAccount(context);
		case "delete-account":
			return deleteAccount(context);
		case "get-main-asset-balance":
			return getMainAssetBalance(context);
		default:
			return { code: 400, message: "Skill not found" };
	}
}

async function createAccount(context: HandlerContext, accountId: string): Promise<SkillResponse> {
	const {
		message: {
			sender,
			content: { params },
		},
	} = context;

	const { blockchain, password, name } = params;

	const formattedChain = blockchain.toLowerCase();
	const allUsersAccounts = await getUserAccounts();

	if (allUsersAccounts[sender.address]?.find((acc) => acc.name === name)) {
		return { code: 400, message: "You already have an account with this name" };
	}

	const account = await genAddress(sender.address, formattedChain, password, accountId);
	if (account.address === undefined || name === undefined) {
		return { code: 500, message: "Account generation failed" };
	}

	allUsersAccounts[sender.address] = [
		...(allUsersAccounts[sender.address] ?? []),
		{
			chain: formattedChain,
			address: account.address,
			name,
			publicKey: account.publicKey,
		},
	];
	await updateUserAccounts(allUsersAccounts);

	return {
		code: 200,
		message: `Account "${name}" created with address ${account.address}.\n\nView it on the explorer: ${explorers[formattedChain as unknown as never]}/address/${account.address}`,
	};
}

async function listAccounts(context: HandlerContext): Promise<SkillResponse> {
	const {
		message: { sender },
	} = context;

	const allUsersAccounts = await getUserAccounts();

	if (allUsersAccounts[sender.address] === undefined) {
		return { code: 400, message: "You don't have any accounts yet." };
	}

	const accounts = allUsersAccounts[sender.address];

	return {
		code: 200,
		message: `You have ${accounts.length} account${accounts.length > 1 ? "s" : ""}:\n\n${accounts.map((acc) => `- ${acc.name} on ${acc.chain}: ${explorers[acc.chain]}/address/${acc.address}\n`).join("")}`,
	};
}

async function sendMainAsset(context: HandlerContext, nearAccount: Account): Promise<SkillResponse> {
	const {
		message: {
			sender,
			content: { params },
		},
	} = context;
	const { account: accountName, amount, password, destination } = params;

	const allUsersAccounts = await getUserAccounts();
	if (allUsersAccounts[sender.address] === undefined) {
		return { code: 400, message: "You don't have any accounts yet." };
	}
	const account = allUsersAccounts[sender.address].find(
		(acc) => acc.name.toLowerCase() === (accountName as string).toLowerCase(),
	);
	if (account === undefined) {
		return { code: 400, message: `Couldn't find account '${accountName}'` };
	}

	const retrievedAccount = await genAddress(sender.address, account.chain, password, nearAccount.accountId);
	if (retrievedAccount.address === undefined || retrievedAccount.address !== account.address) {
		console.error(retrievedAccount.address, account.address);
		return { code: 500, message: "Account regeneration failed, you probably entered the wrong password." };
	}
	const path = await generatePath(sender.address, password);

	switch (account.chain) {
		case "ethereum":
			const { error: ethError, result: ethResult } = await ethereum.send({
				from: account.address,
				to: destination,
				amount: (amount as number).toString(),
				path,
				nearAccount,
			});
			if (ethError === undefined) {
				return {
					code: 200,
					message: `Transaction successfully sent.
${explorers["ethereum"]}/tx/${ethResult}`,
				};
			}

			return { code: 400, message: ethError };
		case "bitcoin":
			const { error: btcError, result: btcResult } = await bitcoin.send({
				from: account.address,
				to: destination,
				amount: (amount as number).toString(),
				path,
				nearAccount,
				publicKey: account.publicKey!,
			});

			if (btcError === undefined) {
				return {
					code: 200,
					message: `Transaction successfully sent.
${explorers["bitcoin"]}/tx/${btcResult}`,
				};
			}
			return { code: 400, message: btcError };
	}
}

async function renameAccount(context: HandlerContext): Promise<SkillResponse> {
	const {
		message: {
			sender,
			content: { params },
		},
	} = context;

	const { oldName, newName } = params;

	const allUsersAccounts = await getUserAccounts();
	if (allUsersAccounts[sender.address] === undefined) {
		return { code: 400, message: "You don't have any accounts yet." };
	}

	const account = allUsersAccounts[sender.address].find(
		(acc) => acc.name.toLowerCase() === (oldName as string).toLowerCase(),
	);
	const newAccount = allUsersAccounts[sender.address].find(
		(acc) => acc.name.toLowerCase() === (newName as string).toLowerCase(),
	);
	if (account === undefined) {
		return { code: 400, message: `Couldn't find account '${oldName}'` };
	}
	if (newAccount !== undefined) {
		return { code: 400, message: `An account with the name '${newName}' already exists` };
	}

	allUsersAccounts[sender.address] = [
		...allUsersAccounts[sender.address].filter((acc) => acc.name !== oldName),
		{
			chain: account.chain,
			address: account.address,
			name: newName,
		},
	];
	await updateUserAccounts(allUsersAccounts);

	return { code: 200, message: `Account name successfully changed from '${oldName}' to '${newName}'` };
}

async function deleteAccount(context: HandlerContext): Promise<SkillResponse> {
	const {
		message: {
			sender,
			content: { params },
		},
	} = context;

	const { name } = params;

	const allUsersAccounts = await getUserAccounts();
	if (allUsersAccounts[sender.address] === undefined) {
		return { code: 400, message: "You don't have any accounts yet." };
	}
	const account = allUsersAccounts[sender.address].find(
		(acc) => acc.name.toLowerCase() === (name as string).toLowerCase(),
	);

	if (account === undefined) {
		return { code: 400, message: `Couldn't find account '${name}'` };
	}

	const answer = await context.awaitResponse(
		"Are you sure you want to delete this account? You'll only be able to retrieve it by using the same password.\nPlease answer with yes or no",
		["yes", "no"],
	);

	if (answer === "no") {
		return { code: 200, message: "Alright, I'm still here if you need anything else!" };
	}

	allUsersAccounts[sender.address] = allUsersAccounts[sender.address].filter((acc) => acc.name !== name);
	await updateUserAccounts(allUsersAccounts);

	return { code: 200, message: `Account '${name}' removed` };
}

async function getMainAssetBalance(context: HandlerContext): Promise<SkillResponse> {
	const {
		message: {
			sender,
			content: { params },
		},
	} = context;
	const { accountName } = params;

	const allUsersAccounts = await getUserAccounts();
	if (allUsersAccounts[sender.address] === undefined) {
		return { code: 400, message: "You don't have any accounts yet." };
	}
	const account = allUsersAccounts[sender.address].find(
		(acc) => acc.name.toLowerCase() === (accountName as string).toLowerCase(),
	);

	if (account === undefined) {
		return { code: 400, message: `Couldn't find account '${accountName}'` };
	}

	switch (account.chain) {
		case "ethereum":
			const ethBalance = await ethereum.getBalance(account.address);
			return {
				code: 200,
				message: `Account ${account.name} has a balance of ${ethers.utils.formatUnits(ethBalance)} ${ethereum.currency}\n\nVerify it in the explorer: ${explorers["ethereum"]}/address/${account.address}`,
			};
		case "bitcoin":
			const btcBalance = await bitcoin.getBalance({ address: account.address });
			return {
				code: 200,
				message: `Account ${account.name} has a balance of ${btcBalance} ${bitcoin.currency}\n\nVerify it in the explorer: ${explorers["bitcoin"]}/address/${account.address}`,
			};
		default:
			return { code: 400, message: "This blockchain doesn't support balance fetching" };
	}
}
