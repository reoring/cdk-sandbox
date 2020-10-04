import { PolicyStatement } from '@aws-cdk/aws-iam';
import { AutoScalingGroup } from '@aws-cdk/aws-autoscaling';
import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';

interface VpcStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
}

export class VpcStack extends cdk.Stack {
  private vpc: ec2.Vpc;

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    console.log("C");

    this.vpc = new ec2.Vpc(this, 'MyVpc', {
      cidr: '172.16.0.0/16',
      maxAzs: 2,
      subnetConfiguration: [
        {
          name: 'ingress',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'application_1',
          subnetType: ec2.SubnetType.PRIVATE,
          cidrMask: 24,
        },
        {
          name: 'application_2',
          subnetType: ec2.SubnetType.PRIVATE,
          cidrMask: 24,
          reserved: true,
        },
        {
          name: 'database',
          subnetType: ec2.SubnetType.ISOLATED,
          cidrMask: 24,
        },
      ],
    });
  }

  getVpc(): ec2.Vpc {
    return this.vpc;
  }
}

export class InstanceStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: VpcStackProps) {
    super(scope, id, props);

    if (!props) {
      return;
    }

    const amznLinux = ec2.MachineImage.latestAmazonLinux({
      generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX,
      edition: ec2.AmazonLinuxEdition.STANDARD,
      virtualization: ec2.AmazonLinuxVirt.HVM,
      storage: ec2.AmazonLinuxStorage.GENERAL_PURPOSE,
      cpuType: ec2.AmazonLinuxCpuType.X86_64,
    });

    const i = new ec2.Instance(this, 'MyInstance', {
      instanceType: new ec2.InstanceType('t2.medium'),
      machineImage: amznLinux,
      vpc: props.vpc,
    });

    i.addToRolePolicy(new PolicyStatement({
      actions: ['ssm:*'],
      resources: ['*'],
    }));

    i.connections.allowFromAnyIpv4(ec2.Port.icmpPing());
    i.addUserData('yum install -y');
  }
}

export class AsgStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: VpcStackProps) {
    super(scope, id, props);

    if (!props) {
      return;
    }

    const lb = new elbv2.ApplicationLoadBalancer(this, 'LB', {
      vpc: props.vpc,
      internetFacing: true
    });

    // Add a listener and open up the load balancer's security group
    // to the world.
    const listener = lb.addListener('Listener', {
      port: 80,

      // 'open: true' is the default, you can leave it out if you want. Set it
      // to 'false' and use `listener.connections` if you want to be selective
      // about who can access the load balancer.
      open: true,
    });

    // Create an AutoScaling group and add it as a load balancing
    // target to the listener.
    const asg = new AutoScalingGroup(this, 'asg', {
      vpc: props.vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.MICRO),
      machineImage: new ec2.AmazonLinuxImage(), // get the latest Amazon Linux image
      maxCapacity: 2,
      minCapacity: 1,
    });

    listener.addTargets('ApplicationFleet', {
      port: 8080,
      targets: [asg]
    });
  }
}