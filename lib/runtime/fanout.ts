import {KinesisStreamEvent} from "aws-lambda";
import {xrayScope} from "./xray";
import * as agg from "aws-kinesis-agg"

import {KinesisClient, PutRecordCommand, PutRecordCommandOutput, PutRecordInput} from "@aws-sdk/client-kinesis";
import {Kinesis} from "aws-sdk";
import {KinesisStreamRecordPayload} from "aws-lambda/trigger/kinesis-stream";
import {rejects} from "assert";



export const lambdaHandler = xrayScope((segment) => async (
    event: KinesisStreamEvent
): Promise<String> => {
    console.log(JSON.stringify(event))
    const client = new KinesisClient({});
    try {
        const partitions:Map<String,KinesisStreamRecordPayload[]> = new Map<String, KinesisStreamRecordPayload[]>();
        const records = event.Records.forEach(incoming => {
            var payload = Buffer.from(incoming.kinesis.data, 'base64').toString('ascii');
            const value = JSON.parse(payload)
            value["received"] = new Date().getTime()

            payload = JSON.stringify(value)
            console.log(`Fanout payload:${payload}`);
            const buffer = Buffer.from(payload)
            const partitionKey = `${incoming.kinesis.partitionKey}_${Math.random().toString(36).substr(2, 5)}`
            const recordPayload={
                data: payload,
                approximateArrivalTimestamp: incoming.kinesis.approximateArrivalTimestamp,
                partitionKey: partitionKey,
                kinesisSchemaVersion: incoming.kinesis.kinesisSchemaVersion,
                sequenceNumber: incoming.kinesis.sequenceNumber

            } as KinesisStreamRecordPayload
            if(partitions.has(partitionKey)){
                partitions.get(partitionKey)?.push(recordPayload)
            }else{
                partitions.set(partitionKey,[recordPayload])
            }

        })

        return new Promise<String>((resolve, reject) => {
            partitions.forEach((value, key) => {
                agg.aggregate(value, (encodedRecord, callback: (err?: Error, data?: Kinesis.Types.PutRecordOutput) => void) => {

                    client.send(new PutRecordCommand({
                        Data:encodedRecord.data,
                        StreamName: process.env.STREAM_NAME,
                        PartitionKey: encodedRecord.partitionKey

                    } )).then(value1 => {
                        console.log(`Success ${JSON.stringify(value1)}`)
                        callback(undefined, {
                            EncryptionType: value1.EncryptionType,
                            SequenceNumber: value1.SequenceNumber!,
                            ShardId: value1.ShardId!
                        })
                        resolve("Success")
                    })
                }, () => {
                }, ((error, data) => {
                    console.log(`Fanout failure: ${error}`)
                    reject(error)
                }))
            })


        })



    } catch (error) {
        console.error(`Fanout failure: ${error}`)
        return "Failure"
    } finally {
        console.log(`Done sending records to outstream`)
    }

}, "fanout-lambda");

