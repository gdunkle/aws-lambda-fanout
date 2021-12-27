import * as AWSXRay from "aws-xray-sdk";
import {  Context } from "aws-lambda";
import { Subsegment } from "aws-xray-sdk";

export type Handler<TEvent = any, TResult = any> = (
    event: TEvent,
    context: Context,
) => Promise<void | TResult>;

export const xrayScope = <TEvent, TResult>(fn: (segment?: Subsegment ) => Handler<TEvent, TResult>,name:string): Handler<TEvent, TResult> => async (e, c) => {
    AWSXRay.captureAWS(require("aws-sdk"));
    AWSXRay.captureHTTPsGlobal(require("http"), true);
    AWSXRay.captureHTTPsGlobal(require("https"), true);
    AWSXRay.capturePromise();
    const segment = AWSXRay.getSegment()?.addNewSubsegment(name);
    if(segment!=null) {
        try {
            return await fn(segment)(e, c) as TResult
        } finally {
            if (!segment.isClosed()) {
                segment.close();
            }
        }
    }else{
        return await fn(undefined)(e, c) as TResult
    }
};