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
  if (region && userPoolId && clientId && clientSecret && client) return;
  region = await getParam("/n11530430/app/REGION");
  userPoolId = await getParam("/n11530430/app/COGNITO_USER_POOL_ID");
  clientId = await getParam("/n11530430/app/COGNITO_CLIENT_ID");
  clientSecret = (await getSecretJSON(SECRET_ID)).COGNITO_CLIENT_SECRET;
  client = new CognitoIdentityProviderClient({ region });
}

async function secretHash(username) {
  await ensureCognito();
  if (!clientSecret) return undefined;
  const hmac = crypto.createHmac("sha256", clientSecret);
  hmac.update(username + clientId);
  return hmac.digest("base64");
}

exports.signUp = async ({ username, password, email }) => {
  await ensureCognito();
  const params = {
    ClientId: clientId,
    Username: username,
    Password: password,
    UserAttributes: [{ Name: "email", Value: email }],
  };
  if (clientSecret) params.SecretHash = secretHash(username);
  return client.send(new SignUpCommand(params));
};

exports.confirmSignUp = async ({ username, code }) => {
  await ensureCognito();
  const params = { ClientId: clientId, Username: username, ConfirmationCode: code };
  if (clientSecret) params.SecretHash = secretHash(username);
  return client.send(new ConfirmSignUpCommand(params));
};

exports.login = async ({ username, password }) => {
  await ensureCognito();
  const AuthParameters = clientSecret
    ? { USERNAME: username, PASSWORD: password, SECRET_HASH: secretHash(username) }
    : { USERNAME: username, PASSWORD: password };
  const resp = await client.send(
    new InitiateAuthCommand({ AuthFlow: "USER_PASSWORD_AUTH", ClientId: clientId, AuthParameters })
  );
  return resp.AuthenticationResult; // { IdToken, AccessToken, RefreshToken, ... }
};

// ===== 驗證 JWT（IdToken） =====
// 使用 Cognito 公開 JWKS，自動抓金鑰並快取
// const jwksUri = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`;
// const JWKS = createRemoteJWKSet(new URL(jwksUri));

const verifier = CognitoJwtVerifier.create({
  userPoolId: userPoolId,
  tokenUse: "id",
  clientId: clientId,
});

exports.verifyIdToken = async (token) => {
  await ensureCognito();
  const payload = await verifier.verify(token);
  return payload; // 含 cognito:username / email / sub 等
};