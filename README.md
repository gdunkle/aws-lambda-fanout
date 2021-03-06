# aws-lambda-fanout

CDK project that sets up the following serverless architecture to test out lambda based kinesis consumers

![](./images/Architecture.drawio.png)

Also creates a dashboard to monitor called "AwsLambdaFanout" to monitor that messages get all the way through the pipeline

![](./images/Dashboard.png)

## Testing

Included is a [JMeter test script](./Test.jmx). 

To run this script you have to deploy the cdk project and then replace the api endpoint in the test script.

## Commands
* `npm install`     install dependencies
* `npm run build`   compile typescript to js
* `cdk deploy -c account=<your_account> -c region=<your_region>` deploy to your aws account


