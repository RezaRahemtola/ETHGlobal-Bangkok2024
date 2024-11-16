import js_sha3 from "js-sha3";
import { base_decode, base_encode } from "near-api-js/lib/utils/serialize.js";
import keccak from "keccak";
import elliptic from "elliptic";
import hash from "hash.js";
import bs58check from "bs58check";
import { generateSeedPhrase } from "near-seed-phrase";

const { ec: EC } = elliptic;
const { sha3_256 } = js_sha3;

function najPublicKeyStrToUncompressedHexPoint(najPublicKeyStr: string): string {
	return "04" + Buffer.from(base_decode(najPublicKeyStr.split(":")[1])).toString("hex");
}

export async function deriveChildPublicKey(
	parentUncompressedPublicKeyHex: string,
	signerId: string,
	path: string = "",
): Promise<string> {
	const ec = new EC("secp256k1");
	const scalarHex = sha3_256(`near-mpc-recovery v0.1.0 epsilon derivation:${signerId},${path}`);

	const x = parentUncompressedPublicKeyHex.substring(2, 66);
	const y = parentUncompressedPublicKeyHex.substring(66);

	// Create a point object from X and Y coordinates
	const oldPublicKeyPoint = ec.curve.point(x, y);

	// Multiply the scalar by the generator point G
	const scalarTimesG = ec.g.mul(scalarHex);

	// Add the result to the old public key point
	const newPublicKeyPoint = oldPublicKeyPoint.add(scalarTimesG);
	const newX = newPublicKeyPoint.getX().toString("hex").padStart(64, "0");
	const newY = newPublicKeyPoint.getY().toString("hex").padStart(64, "0");
	return "04" + newX + newY;
}

export async function generateAddress({
	publicKey,
	accountId,
	path,
	chain,
}: {
	publicKey: string;
	accountId: string;
	path: string;
	chain: string;
}) {
	const childPublicKey = await deriveChildPublicKey(najPublicKeyStrToUncompressedHexPoint(publicKey), accountId, path);
	let address, nearSecpPublicKey, nearImplicitSecretKey;
	switch (chain) {
		case "ethereum":
			address = uncompressedHexPointToEvmAddress(childPublicKey);
			break;
		case "near":
			const { implicitAccountId, implicitSecpPublicKey, implicitAccountSecretKey } =
				await uncompressedHexPointToNearImplicit(childPublicKey);
			address = implicitAccountId;
			nearSecpPublicKey = implicitSecpPublicKey;
			nearImplicitSecretKey = implicitAccountSecretKey;
			break;
		case "bitcoin":
			address = await uncompressedHexPointToBtcAddress(childPublicKey, Buffer.from([0x6f]));
			break;
	}
	return {
		// @ts-ignore
		address,
		publicKey: childPublicKey,
		nearSecpPublicKey,
		nearImplicitSecretKey,
	};
}

function uncompressedHexPointToEvmAddress(uncompressedHexPoint: string): string {
	const address = keccak("keccak256")
		.update(Buffer.from(uncompressedHexPoint.substring(2), "hex"))
		.digest("hex");

	// Ethereum address is last 20 bytes of hash (40 characters), prefixed with 0x
	return "0x" + address.substring(address.length - 40);
}

async function uncompressedHexPointToNearImplicit(uncompressedHexPoint: string) {
	// console.log('uncompressedHexPoint', uncompressedHexPoint);

	const implicitSecpPublicKey = "secp256k1:" + base_encode(Buffer.from(uncompressedHexPoint.substring(2), "hex"));
	// get an implicit accountId from an ed25519 keyPair using the sha256 of the secp256k1 point as entropy
	const sha256HashOutput = await crypto.subtle.digest("SHA-256", Buffer.from(uncompressedHexPoint, "hex"));
	const { publicKey, secretKey: implicitAccountSecretKey } = generateSeedPhrase(Buffer.from(sha256HashOutput));

	// DEBUG
	// console.log(secretKey);

	const implicitAccountId = Buffer.from(base_decode(publicKey.split(":")[1])).toString("hex");

	// DEBUG adding key
	// await addKey({
	//     accountId: implicitAccountId,
	//     secretKey,
	//     publicKey: implicitSecpPublicKey,
	// });

	return {
		implicitAccountId,
		implicitSecpPublicKey,
		implicitAccountSecretKey,
	};
}

async function uncompressedHexPointToBtcAddress(publicKeyHex: string, networkByte: Uint8Array): Promise<string> {
	// Step 1: SHA-256 hashing of the public key
	const publicKeyBytes = Uint8Array.from(Buffer.from(publicKeyHex, "hex"));

	const sha256HashOutput = await crypto.subtle.digest("SHA-256", publicKeyBytes);

	// Step 2: RIPEMD-160 hashing on the result of SHA-256
	const ripemd160 = hash.ripemd160().update(Buffer.from(sha256HashOutput)).digest();

	// Step 3: Adding network byte (0x00 for Bitcoin Mainnet)
	const networkByteAndRipemd160 = Buffer.concat([networkByte, Buffer.from(ripemd160)]);

	// Step 4: Base58Check encoding
	const address = bs58check.encode(networkByteAndRipemd160);

	return address;
}
