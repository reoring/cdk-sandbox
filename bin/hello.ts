#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { VpcStack, InstanceStack, AsgStack } from '../lib/hello-stack';

const props = {
  env: { 
    account: process.env.CDK_DEPLOY_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEPLOY_REGION || process.env.CDK_DEFAULT_REGION 
  }
};

const app = new cdk.App();

console.log("A");
const vpcStack = new VpcStack(app, 'MyVPC', props);
console.log("B");
const vpcProps = {...props, vpc: vpcStack.getVpc()};

const instanceStack = new InstanceStack(app, 'MyInstance', vpcProps)
const asgStack = new AsgStack(app, 'MyAsg', vpcProps)

instanceStack.addDependency(vpcStack);
asgStack.addDependency(vpcStack);

app.synth();