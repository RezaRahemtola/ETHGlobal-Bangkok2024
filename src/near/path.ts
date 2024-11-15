import { sha256 } from "js-sha256";

export const generatePath = async (userAddress: string, password: string): Promise<string> => {
	const hashedPassword = sha256(password);
	return `${userAddress}-${hashedPassword}`;
};
