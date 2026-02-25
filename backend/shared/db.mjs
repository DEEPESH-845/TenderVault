import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

/**
 * Get a single item from DynamoDB by key.
 * @param {string} tableName
 * @param {object} key - Primary key object, e.g. { tenderId: '...' }
 * @returns {Promise<object|null>}
 */
export async function getItem(tableName, key) {
  const result = await docClient.send(new GetCommand({
    TableName: tableName,
    Key: key,
  }));
  return result.Item || null;
}

/**
 * Put a single item into DynamoDB.
 * @param {string} tableName
 * @param {object} item
 * @returns {Promise<void>}
 */
export async function putItem(tableName, item) {
  await docClient.send(new PutCommand({
    TableName: tableName,
    Item: item,
  }));
}

/**
 * Query items from DynamoDB using a key condition.
 * @param {string} tableName
 * @param {object} params - Query parameters
 * @param {string} params.indexName - Optional GSI name
 * @param {string} params.keyConditionExpression
 * @param {object} params.expressionAttributeValues
 * @param {object} [params.expressionAttributeNames]
 * @param {string} [params.filterExpression]
 * @param {number} [params.limit]
 * @param {boolean} [params.scanIndexForward]
 * @param {object} [params.exclusiveStartKey]
 * @returns {Promise<{items: object[], lastEvaluatedKey: object|undefined}>}
 */
export async function queryItems(tableName, params) {
  const command = new QueryCommand({
    TableName: tableName,
    IndexName: params.indexName,
    KeyConditionExpression: params.keyConditionExpression,
    ExpressionAttributeValues: params.expressionAttributeValues,
    ExpressionAttributeNames: params.expressionAttributeNames,
    FilterExpression: params.filterExpression,
    Limit: params.limit,
    ScanIndexForward: params.scanIndexForward ?? true,
    ExclusiveStartKey: params.exclusiveStartKey,
  });
  const result = await docClient.send(command);
  return {
    items: result.Items || [],
    lastEvaluatedKey: result.LastEvaluatedKey,
  };
}

/**
 * Scan a DynamoDB table.
 * @param {string} tableName
 * @param {object} [params]
 * @param {string} [params.filterExpression]
 * @param {object} [params.expressionAttributeValues]
 * @param {object} [params.expressionAttributeNames]
 * @param {number} [params.limit]
 * @param {object} [params.exclusiveStartKey]
 * @returns {Promise<{items: object[], lastEvaluatedKey: object|undefined}>}
 */
export async function scanItems(tableName, params = {}) {
  const command = new ScanCommand({
    TableName: tableName,
    FilterExpression: params.filterExpression,
    ExpressionAttributeValues: params.expressionAttributeValues,
    ExpressionAttributeNames: params.expressionAttributeNames,
    Limit: params.limit,
    ExclusiveStartKey: params.exclusiveStartKey,
  });
  const result = await docClient.send(command);
  return {
    items: result.Items || [],
    lastEvaluatedKey: result.LastEvaluatedKey,
  };
}

/**
 * Update an item in DynamoDB.
 * @param {string} tableName
 * @param {object} key
 * @param {string} updateExpression
 * @param {object} expressionAttributeValues
 * @param {object} [expressionAttributeNames]
 * @returns {Promise<object>}
 */
export async function updateItem(tableName, key, updateExpression, expressionAttributeValues, expressionAttributeNames) {
  const result = await docClient.send(new UpdateCommand({
    TableName: tableName,
    Key: key,
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: expressionAttributeValues,
    ExpressionAttributeNames: expressionAttributeNames,
    ReturnValues: 'ALL_NEW',
  }));
  return result.Attributes;
}

/**
 * Delete a single item from DynamoDB by key.
 * @param {string} tableName
 * @param {object} key - Primary key object, e.g. { tenderId: '...' }
 * @returns {Promise<void>}
 */
export async function deleteItem(tableName, key) {
  await docClient.send(new DeleteCommand({
    TableName: tableName,
    Key: key,
  }));
}
