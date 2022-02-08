import {KinesisStreamEvent} from "aws-lambda";
import {xrayScope} from "./xray";
import * as agg from "aws-kinesis-agg"
import {
    AttributeValueUpdate,
    DynamoDBClient,
    PutItemCommand,
    UpdateItemCommand,
    UpdateItemCommandOutput
} from "@aws-sdk/client-dynamodb";

export const lambdaHandler = xrayScope((segment) => async (
    event: KinesisStreamEvent
): Promise<String[]> => {
    const client = new DynamoDBClient({});
    try {
        console.log(`Event: ${JSON.stringify(event)}`)
        const results =  event.Records.map(record => {
            // Kinesis data is base64 encoded so decode here
            const userRecords:agg.UserRecord[] = []
            agg.deaggregateSync(record.kinesis,false,(err, r) => {
                r?.forEach(value1 => {
                    userRecords.push(value1)
                })
            })
            return userRecords.map(userRecord => {
                var payload = Buffer.from(userRecord.data, 'base64').toString('ascii');
                const value = JSON.parse(payload)
                console.log(value)
                const updateItem: UpdateItemCommand = new UpdateItemCommand({
                    Key: {
                        "id": {
                            S: value["id"]
                        },
                        "partition": {
                            S: userRecord.partitionKey
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
                return client.send(updateItem).then(response => {
                    console.log(`Downstream response: ${JSON.stringify(response)}`)
                    return "Success"
                }).catch(reason => {
                    console.log(`Downstream error: ${reason}`)
                    return "Failure"
                })
            })

        });

        const promises:Promise<String>[]=[]
        results.forEach(value => {
            value.forEach(value1 => {
                promises.push(value1)
            })
        })
        return Promise.all(promises).then(value => {
            return value
        })
    } catch (error) {
        console.log(`Downstream error: ${error}`)
        return Promise.resolve(["Failure"])
    } finally {
        console.log(`Done sending records to dynamodb`)
    }

}, "downstream-lambda");

