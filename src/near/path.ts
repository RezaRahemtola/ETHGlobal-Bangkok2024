import js_sha3 from "js-sha3";

const { sha3_256 } = js_sha3;

export const generatePath = async (userAddress: string, password: string): Promise<string> => {
	const hashedPassword = sha3_256(password);
	return `${userAddress}-${hashedPassword}`;
};
