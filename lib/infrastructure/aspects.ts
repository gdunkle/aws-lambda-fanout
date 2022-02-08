import {CfnElement, IAspect, Stack, Token} from "aws-cdk-lib";
import {IConstruct, Node} from "constructs";
import {CfnStage} from "aws-cdk-lib/aws-apigatewayv2";
import {LogGroup} from "aws-cdk-lib/aws-logs";

export class LogGroupNamingConventions implements IAspect {
    visit(node: IConstruct): void {
        //check for api gateway stages
        if (node instanceof CfnStage) {

            if (node.accessLogSettings != null && "destinationArn" in node.accessLogSettings) {
                const value = node.accessLogSettings["destinationArn"]
                if (Token.isUnresolved(value)) {
                    const resolvedValue = node.stack.resolve(value)
                    validateLogGroupNameForCfnStage(node, resolvedValue)
                } else {
                    validateLogGroupNameForCfnStage(node, value)
                }
            } else {
                throw Error("You must explicitly specify and access log group for each API GW stage the starts with the prefix /aws/apigw")
            }

        }
    }

}

/**
 *
 * @param node
 * @param value
 */
function validateLogGroupNameForCfnStage(node: CfnStage, value: any): boolean {
    let logicalId
    if (value instanceof Object && "Fn::GetAtt" in value) {
        logicalId = value["Fn::GetAtt"][0]
    } else {
        logicalId = value
    }
    const logGroup = findChildByLogicalId(node.stack, node.stack, logicalId) as LogGroup
    if (logGroup != null) {
        if (logGroup.logGroupPhysicalName() != null) {
            if (logGroup.logGroupPhysicalName().startsWith("/aws/apigw")) {
                return true
            } else {
                throw Error(`Name for Log group ${logGroup.node.id} (${logGroup.logGroupPhysicalName()}) should start with /aws/apigw`)
            }

        } else {
            throw Error(`Log group name not specified for ${logGroup.node.id}`)
        }

    } else {
        throw Error(`No log group associated with stage ${node.node.id}`)
    }
}

/**
 * Recursively walk the stack from the given node looking for a resource with the specified logicalId
 *
 * @param stack
 * @param node
 * @param logicalId
 */
function findChildByLogicalId(stack: Stack, node: IConstruct, logicalId: string): IConstruct | undefined {
    return node.node.children.filter(value => {
        return value.node != null && value.node.defaultChild != null
    }).find(value => {
        if (stack.getLogicalId((value.node.defaultChild as CfnElement)) == logicalId) {
            return true
        } else if (value.node.children.length > 0) {
            return value.node.children.map(child => {
                return findChildByLogicalId(stack, child, logicalId)
            }).find(value1 => {
                return value1 != null
            })
        } else {
            return false
        }
    })
}