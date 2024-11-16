import { HandlerContext, SkillResponse } from "@xmtp/message-kit";
import { genAddress, genNearAccount } from "../near/near.js";
import { getUserAccounts, updateUserAccounts } from "../aleph/aleph.js";
import ethereum from "../near/ethereum.js";
import { Account } from "near-api-js";
import { generatePath } from "../near/path.js";

const BLOCKSCOUT_URL_ETH = "https://eth-sepolia.blockscout.com";

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

	const allUsersAccounts = await getUserAccounts();

	if (allUsersAccounts[sender.address]?.find((acc) => acc.name === name)) {
		return { code: 400, message: "You already have an account with this name" };
	}

	const account = await genAddress(sender.address, blockchain, password, accountId);
	if (account.address === undefined || name === undefined) {
		return { code: 500, message: "Account generation failed" };
	}

	allUsersAccounts[sender.address] = [
		...(allUsersAccounts[sender.address] ?? []),
		{
			chain: blockchain,
			address: account.address,
			name,
		},
	];
	await updateUserAccounts(allUsersAccounts);

	return {
		code: 200,
		message: `Account "${name}" created with address ${account.address}.\n\nView it on the explorer: ${BLOCKSCOUT_URL_ETH}/address/${account.address}`,
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
		message: `You have ${accounts.length} account${accounts.length > 1 ? "s" : ""}:\n\n${accounts.map((acc) => `- ${acc.name} on ${acc.chain}: ${BLOCKSCOUT_URL_ETH}/address/${acc.address}\n`)}`,
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

	const { error, result } = await ethereum.send({
		from: account.address,
		to: destination,
		amount: (amount as number).toString(),
		path,
		nearAccount,
	});

	if (error === undefined) {
		return {
			code: 200,
			message: `Transaction successfully sent.
${BLOCKSCOUT_URL_ETH}/tx/${result}`,
		};
	}

	return { code: 400, message: error };
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
