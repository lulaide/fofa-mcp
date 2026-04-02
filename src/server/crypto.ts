import { EncryptJWT, jwtDecrypt, SignJWT, jwtVerify } from "jose";
import { randomBytes } from "node:crypto";

export interface ServerSecrets {
  jweKey: Uint8Array; // 32 bytes for A256GCM
  jwsKey: Uint8Array;
}

export interface CodePayload {
  baseURL: string;
  apiKey: string;
  email: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
}

export interface TokenPayload {
  baseURL: string;
  apiKey: string;
  email: string;
  clientId: string;
  scopes: string[];
}

export function loadSecrets(): ServerSecrets {
  const jweEnv = process.env.JWE_SECRET;
  const jwsEnv = process.env.JWS_SECRET;

  // 未设置则自动生成（重启后旧 token 失效，客户端会自动重新 OAuth）
  const jweKey = jweEnv ? Buffer.from(jweEnv, "base64") : randomBytes(32);
  const jwsKey = jwsEnv ? Buffer.from(jwsEnv, "base64") : randomBytes(32);

  if (jweKey.length !== 32) {
    throw new Error("JWE_SECRET 必须是 32 字节（base64 编码后约 44 字符）");
  }
  if (jwsKey.length < 32) {
    throw new Error("JWS_SECRET 至少需要 32 字节");
  }

  if (!jweEnv || !jwsEnv) {
    console.log("未设置 JWE_SECRET/JWS_SECRET，已自动生成（重启后旧 token 将失效）");
  }

  return {
    jweKey: new Uint8Array(jweKey),
    jwsKey: new Uint8Array(jwsKey),
  };
}

export async function encryptCode(secrets: ServerSecrets, payload: CodePayload): Promise<string> {
  return new EncryptJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .encrypt(secrets.jweKey);
}

export async function decryptCode(secrets: ServerSecrets, jwe: string): Promise<CodePayload> {
  const { payload } = await jwtDecrypt(jwe, secrets.jweKey);
  return {
    baseURL: payload.baseURL as string,
    apiKey: payload.apiKey as string,
    email: payload.email as string,
    codeChallenge: payload.codeChallenge as string,
    codeChallengeMethod: payload.codeChallengeMethod as string,
    clientId: payload.clientId as string,
    redirectUri: payload.redirectUri as string,
    scopes: payload.scopes as string[],
  };
}

export async function signToken(secrets: ServerSecrets, payload: TokenPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("365d")
    .sign(secrets.jwsKey);
}

export async function verifyToken(secrets: ServerSecrets, jws: string): Promise<TokenPayload & { exp: number }> {
  const { payload } = await jwtVerify(jws, secrets.jwsKey);
  return {
    baseURL: payload.baseURL as string,
    apiKey: payload.apiKey as string,
    email: payload.email as string,
    clientId: payload.clientId as string,
    scopes: payload.scopes as string[],
    exp: payload.exp as number,
  };
}
