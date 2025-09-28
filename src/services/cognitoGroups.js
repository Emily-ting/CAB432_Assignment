require("dotenv").config();
const {
  CognitoIdentityProviderClient,
  CreateGroupCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  ListGroupsForUserCommand,
} = require("@aws-sdk/client-cognito-identity-provider");
const { getParam } = require("../aws/ssm");

const SECRET_ID = "n11530430/cognito";

let region, userPoolId, client;

async function ensureCognito() {
  if (region && userPoolId && client) return;
  region = await getParam("/n11530430/app/REGION");
  userPoolId = await getParam("/n11530430/app/COGNITO_USER_POOL_ID");
  client = new CognitoIdentityProviderClient({ region });
}

exports.createGroup = async (groupName, desc = "") => {
  await ensureCognito();
  return client.send(new CreateGroupCommand({ UserPoolId: userPoolId, GroupName: groupName, Description: desc }));
};
exports.addUserToGroup = async (username, groupName) => {
  await ensureCognito();
  return client.send(new AdminAddUserToGroupCommand({ UserPoolId: userPoolId, Username: username, GroupName: groupName }));
};
exports.removeUserFromGroup = async (username, groupName) => {
  await ensureCognito();
  return client.send(new AdminRemoveUserFromGroupCommand({ UserPoolId: userPoolId, Username: username, GroupName: groupName }));
};
exports.listUserGroups = async (username) => {
  await ensureCognito();
  const r = await client.send(new ListGroupsForUserCommand({ UserPoolId: userPoolId, Username: username }));
  return (r.Groups || []).map(g => g.GroupName);
};