# Welcome to your CDK TypeScript project!

This is a blank project for TypeScript development with CDK.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template

## ピン留め確認用のCDK
https://docs.aws.amazon.com/ja_jp/AmazonRDS/latest/AuroraUserGuide/rds-proxy.html#rds-proxy-pinning

https://dev.classmethod.jp/articles/rds-proxy-avoid-session-pinning/

## AWS SSMの設定

https://docs.aws.amazon.com/ja_jp/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html

```
aws ssm start-session --target i-xxxxxx
```

## RDS Proxy ピン留め確認
RDS ProxyのログはCloudWatchから見る

`sql_mode` 、`sql_auto_is_null` の設定で発生しそう。

例

```
SET @@SESSION.sql_auto_is_null = 0;
SET @@SESSION.sql_mode = CONCAT(CONCAT(@@sql_mode, ',STRICT_ALL_TABLES'), ',NO_AUTO_VALUE_ON_ZERO');
```