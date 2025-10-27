require("dotenv").config();
const crypto = require("crypto");
const {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
} = require("@aws-sdk/client-cognito-identity-provider");
const { CognitoJwtVerifier } = require("aws-jwt-verify");
const { getSecretJSON } = require("../aws/secrets");
const { getParam } = require("../aws/ssm");

const SECRET_ID = "n11530430/cognito";

let region, userPoolId, clientId, clientSecret, client;

async function ensureCognito() {
  if (region && userPoolId && clientId && typeof clientSecret === "string" && client) return;
  region = await getParam("/n11530430/app/REGION");
  userPoolId = await getParam("/n11530430/app/COGNITO_USER_POOL_ID");
  clientId = await getParam("/n11530430/app/COGNITO_CLIENT_ID");
  const sec = await getSecretJSON(SECRET_ID);
  clientSecret = sec?.COGNITO_CLIENT_SECRET || "";

  if (!region || !userPoolId || !clientId) {
    throw new Error("Missing Cognito config: REGION / USER_POOL_ID / CLIENT_ID");
  }

  console.log("region:", region, ", userPoolId:", userPoolId, ", clientId:", clientId, ", clientSecret:", clientSecret);
  client = new CognitoIdentityProviderClient({ region });
}

/** 同步版：僅在 ensureCognito() 之後呼叫 */
function secretHash(username) {
  if (!clientSecret) return undefined;
  const hmac = crypto.createHmac("sha256", clientSecret);
  hmac.update(username + clientId);
  return hmac.digest("base64");
}

exports.signUp = async ({ username, password, email }) => {
  await ensureCognito();
  const params = {
    ClientId: clientId,
    Username: String(username),
    Password: String(password),
    UserAttributes: [{ Name: "email", Value: String(email) }],
  };
  const sh = secretHash(username);
  if (sh) params.SecretHash = sh;
  return client.send(new SignUpCommand(params));
};

exports.confirmSignUp = async ({ username, code }) => {
  await ensureCognito();
  const params = { ClientId: clientId, Username: String(username), ConfirmationCode: String(code) };
  const sh = secretHash(username);
  if (sh) params.SecretHash = sh;
  return client.send(new ConfirmSignUpCommand(params));
};

exports.login = async ({ username, password }) => {
  await ensureCognito();
  const sh = secretHash(username);
  const AuthParameters = sh
    ? { USERNAME: String(username), PASSWORD: String(password), SECRET_HASH: sh }
    : { USERNAME: String(username), PASSWORD: String(password) };
  const resp = await client.send(
    new InitiateAuthCommand({ AuthFlow: "USER_PASSWORD_AUTH", ClientId: clientId, AuthParameters })
  );
  return resp.AuthenticationResult; // { IdToken, AccessToken, RefreshToken, ... }
};

// ===== 驗證 JWT（IdToken） =====
// 使用 Cognito 公開 JWKS，自動抓金鑰並快取

exports.verifyIdToken = async (token) => {
  await ensureCognito();
  const verifier = CognitoJwtVerifier.create({
    userPoolId: userPoolId,
    tokenUse: "id",
    clientId: clientId,
  });
  const payload = await verifier.verify(token);
  return payload; // 含 cognito:username / email / sub 等
};