require("dotenv").config();
const crypto = require("crypto");
const {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
} = require("@aws-sdk/client-cognito-identity-provider");
const { createRemoteJWKSet, jwtVerify } = require("jose");

const region = process.env.AWS_REGION || "ap-southeast-2";
const userPoolId = process.env.COGNITO_USER_POOL_ID;
const clientId = process.env.COGNITO_CLIENT_ID;
const clientSecret = process.env.COGNITO_CLIENT_SECRET || "";

const client = new CognitoIdentityProviderClient({ region });

function secretHash(username) {
  if (!clientSecret) return undefined;
  const hmac = crypto.createHmac("sha256", clientSecret);
  hmac.update(username + clientId);
  return hmac.digest("base64");
}

exports.signUp = async ({ username, password, email }) => {
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
  const params = { ClientId: clientId, Username: username, ConfirmationCode: code };
  if (clientSecret) params.SecretHash = secretHash(username);
  return client.send(new ConfirmSignUpCommand(params));
};

exports.login = async ({ username, password }) => {
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
const jwksUri = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`;
const JWKS = createRemoteJWKSet(new URL(jwksUri));

exports.verifyIdToken = async (token) => {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
    audience: clientId,
  });
  return payload; // 含 cognito:username / email / sub 等
};