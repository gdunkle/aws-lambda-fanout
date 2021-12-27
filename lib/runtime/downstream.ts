import {KinesisStreamEvent} from "aws-lambda";
import {xrayScope} from "./xray";

import {AttributeValueUpdate, DynamoDBClient, PutItemCommand, UpdateItemCommand} from "@aws-sdk/client-dynamodb";

export const lambdaHandler = xrayScope((segment) => async (
    event: KinesisStreamEvent
): Promise<String> => {
    const client = new DynamoDBClient({});
    try {
        const results = await Promise.all(event.Records.map(record => {
            // Kinesis data is base64 encoded so decode here
            var payload = Buffer.from(record.kinesis.data, 'base64').toString('ascii');
            const value = JSON.parse(payload)

            const updateItem: UpdateItemCommand = new UpdateItemCommand({
                Key: {
                    "id": {
                        S: value["id"]
                    },
                    "partition": {
                        S: record.kinesis.partitionKey
                    }
                },
                AttributeUpdates: {
                    "data": {
                        Action: "PUT",
                        Value: {
                            S: JSON.stringify(value)
                        }

                    },
                    "message_counter": {
                        Action: "ADD",
                        Value: {
                            N: "1"
                        }
                    }
                },

                TableName: process.env.TABLE_NAME!

            });
            return client.send(updateItem)
        }));
        results.forEach(r => {
            console.log(`Downstream response: ${JSON.stringify(r)}`)
        })
        return "Success"
    } catch (error) {
        console.log(`Downstream error: ${error}`)
        return "Failure"
    } finally {
        console.log(`Done sending records to dynamodb`)
    }

}, "downstream-lambda");

