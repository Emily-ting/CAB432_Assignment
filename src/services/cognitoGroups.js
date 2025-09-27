require("dotenv").config();
const {
  CognitoIdentityProviderClient,
  CreateGroupCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  ListGroupsForUserCommand,
} = require("@aws-sdk/client-cognito-identity-provider");

const region = process.env.AWS_REGION || "ap-southeast-2";
const userPoolId = process.env.COGNITO_USER_POOL_ID;
const client = new CognitoIdentityProviderClient({ region });

exports.createGroup = async (groupName, desc = "") => {
  return client.send(new CreateGroupCommand({ UserPoolId: userPoolId, GroupName: groupName, Description: desc }));
};
exports.addUserToGroup = async (username, groupName) => {
  return client.send(new AdminAddUserToGroupCommand({ UserPoolId: userPoolId, Username: username, GroupName: groupName }));
};
exports.removeUserFromGroup = async (username, groupName) => {
  return client.send(new AdminRemoveUserFromGroupCommand({ UserPoolId: userPoolId, Username: username, GroupName: groupName }));
};
exports.listUserGroups = async (username) => {
  const r = await client.send(new ListGroupsForUserCommand({ UserPoolId: userPoolId, Username: username }));
  return (r.Groups || []).map(g => g.GroupName);
};