import {KinesisStreamEvent} from "aws-lambda";
import {xrayScope} from "./xray";

import {KinesisClient, PutRecordCommand, PutRecordCommandOutput} from "@aws-sdk/client-kinesis";

export const lambdaHandler = xrayScope((segment) => async (
    event: KinesisStreamEvent
): Promise<String> => {
    const client = new KinesisClient({});
    try {
        const value: PutRecordCommandOutput[] = await Promise.all(event.Records.map(record => {
            // Kinesis data is base64 encoded so decode here
            var payload = Buffer.from(record.kinesis.data, 'base64').toString('ascii');
            const value = JSON.parse(payload)
            value["received"] = new Date().getTime()
            payload = JSON.stringify(value)
            console.log(`Fanout payload:${payload}`);
            const buffer = Buffer.from(payload)

            return client.send(new PutRecordCommand({
                Data: buffer,
                StreamName: process.env.STREAM_NAME,
                PartitionKey: record.kinesis.partitionKey
            }))

        }))

        value.forEach(r => {
            console.log(`Fanout success: ${JSON.stringify(r)}`)
        })
        return "Success"

    } catch (error) {
        console.log(`Fanout failure: ${error}`)
        return "Failure"
    } finally {
        console.log(`Done sending records to outstream`)
    }

}, "fanout-lambda");

