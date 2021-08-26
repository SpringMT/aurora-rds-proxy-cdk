import * as cdk from '@aws-cdk/core'
import * as ec2 from '@aws-cdk/aws-ec2'
import * as rds from '@aws-cdk/aws-rds'

export class AuroraRdsProxyCdkStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    // Create VPC
    const vpc = new ec2.Vpc(this, 'aurora-rds-proxy-vpc', {
      subnetConfiguration: [
         {
           cidrMask: 24,
           name: 'application',
           subnetType: ec2.SubnetType.PUBLIC,
         },
         {
           cidrMask: 28,
           name: 'rds',
           subnetType: ec2.SubnetType.ISOLATED,
         }
      ]
    })

    const ec2ToRDSProxyGroup = new ec2.SecurityGroup(this, 'EC2 to RDS Proxy',{
      vpc,
    })
    const dbConGroup = new ec2.SecurityGroup(this, 'Proxy to DB',{
      vpc,
    })
    // DBへのアクセス
    dbConGroup.addIngressRule(
      dbConGroup,
      ec2.Port.tcp(3306),
      'allow db connection'
    )
    dbConGroup.addIngressRule(
      ec2ToRDSProxyGroup,
      ec2.Port.tcp(3306),
      'allow ec2 connection'
    )

    // https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-ec2.BastionHostLinux.html  
    const host = new ec2.BastionHostLinux(this, 'BastionHost', {
      vpc,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T2,
        ec2.InstanceSize.MICRO
      ),
      securityGroup: ec2ToRDSProxyGroup,
      subnetSelection: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
    })
    host.instance.addUserData('yum -y update', 'yum install -y mysql jq')

    const dbuser = 'admin'
    const dbname = 'aurora_rds_proxy'
    const engine = rds.DatabaseClusterEngine.auroraMysql({ version: rds.AuroraMysqlEngineVersion.VER_2_09_2 })
    const credentials = rds.Credentials.fromGeneratedSecret(dbuser) // 自動的にパスワード生成してくれる
    const cluster = new rds.DatabaseCluster(this, 'aurora-rds-proxy', {
      engine,
      credentials,
      instances: 1, // read replicaの数
      instanceProps: {
        // optional , defaults to t3.medium
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.MEMORY6_GRAVITON, ec2.InstanceSize.LARGE),
        vpcSubnets: {
          subnets: vpc.isolatedSubnets
        },
        vpc,
        enablePerformanceInsights: true,
        deleteAutomatedBackups: true,
        securityGroups: [dbConGroup],
      },
      defaultDatabaseName: dbname,
      // http://blog.father.gedow.net/2016/05/23/amazon-aurora-parameter/
      // https://aws.amazon.com/jp/blogs/news/best-practices-for-amazon-aurora-mysql-database-configuration/
      parameterGroup: new rds.ParameterGroup(this, 'aurora-rds-proxy Parameter', {
        engine,
        parameters: {
          character_set_client: 'utf8mb4',
          character_set_server: 'utf8mb4',
          collation_connection: 'utf8mb4_bin',
          collation_server: 'utf8mb4_bin',
          time_zone: 'UTC',
          max_connections: '2000',
          wait_timeout: '5',
          innodb_lock_wait_timeout: '5', // APIのタイムアウト以内にする
          query_cache_type: '0',
          slow_query_log: '1',
          long_query_time: '0.5',
        },
      }),
      removalPolicy: cdk.RemovalPolicy.DESTROY // テスト用なので消す
    })
    const proxy = cluster.addProxy(id + '-proxy', {
      secrets: [cluster.secret!],
      debugLogging: true,
      vpc,
      securityGroups: [dbConGroup],
      requireTLS: false // テスド用なのでfalse
    })
  }
}
