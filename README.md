# jest-localstack-preset

🥾 A simple way to do testing AWS Services and Jest or Serverless and Jest

[![ci](https://github.com/thadeu/jest-localstack-preset/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/thadeu/jest-localstack-preset/actions/workflows/ci.yml)
[![Npm package version](https://badgen.net/npm/v/@thadeu/jest-localstack-preset)](https://www.npmjs.com/package/@thadeu/jest-localstack-preset)

## Install

Install via yarn or npm

```bash
$ yarn add -D @thadeu/jest-localstack-preset
```

or

```bash
$ npm i -D @thadeu/jest-localstack-preset
```

## Dependencies

- Docker
- [LocalStack Image](https://docs.localstack.cloud/get-started/#starting-localstack-with-docker)
- NodeJS >= 18.x

## Configuration

Configure `jest.config.js`, adding a custom `preset` and `setupFiles`

```js
module.exports = {
  preset: '@thadeu/jest-localstack-preset',
  setupFiles: ['./jest.setup.js'],
  ...
}
```

### Package.json configuration

```js
  "jest": {
    "verbose": true,
    "testEnvironment": "node",
    "preset": "@thadeu/jest-localstack-preset",
    "setupFiles": [
      "<rootDir>/.jest.setup.js"
    ]
  },
```

Create `jest.localstack.js` file with your required services, for example.

```js
module.exports = {
  services: ['dynamodb', 'kinesis', 's3', 'apigateway', 'lambda'],
  showLog: false,
  readyTimeout: 10000,
  autoPullImage: true,
  S3Buckets: [
    {
      Bucket: 'examplebucket',
    },
  ],
  DynamoDB: [
    {
      TableName: `users_test`,
      BillingMode: 'PAY_PER_REQUEST',
      KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' },
        { AttributeName: 'sk', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'pk', AttributeType: 'S' },
        { AttributeName: 'sk', AttributeType: 'S' },
      ],
    },
  ],
}
```

| Key           | Value    | Description                                        |
| ------------- | -------- | -------------------------------------------------- |
| readyTimeout  | boolean  | Define timeout in milliseconds to create container |
| autoPullImage | boolean  | Define if we go to download image automatically    |
| showLog       | boolean  | Define show logs for localstack                    |
| services      | [string] | List of AWS Services                               |

> You can define environment `JEST_LOCALSTACK_AUTO_PULLING` to precede autoPullImage configuration in your CI/CD

Create a file `jest.setup.js`

```js
// Add local configuration 
process.env.REGION = 'eu-west-2'
```

## Usage

Since aws-sdk v3 each component required individual configuration and `configureMockSDK` function is not required anymore like in version 1.x of this plugin.

> We will apply this

```js
{
  credentials: {
    accessKeyId: 'access-key',
    secretAccessKey: 'secret-key',
  },
  region: 'us-east-1',
  endpoint: 'http://localhost:4566',
  s3ForcePathStyle: true,
}
```

But, if you need configure in runtime, enjoy and to do that. Anywhere you can use the `endpoint_url` to access localstack services locally.

So, use custom endpoint `process.env.AWS_ENDPOINT_URL` for general or specific to DynamoDB `process.env.AWS_DYNAMODB_ENDPOINT_URL` in the AWS clients in your code.

For example to use DynamoDB or S3.

```js
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { PutCommand, ScanCommand, DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({
  endpoint: process.env.AWS_DYNAMODB_ENDPOINT_URL,
});
const docClient = DynamoDBDocumentClient.from(client);
```

So, create your tests using Jest.

An example for DynamoDB.

```js
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { PutCommand, ScanCommand, DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({
  endpoint: process.env.AWS_DYNAMODB_ENDPOINT_URL,
});
const docClient = DynamoDBDocumentClient.from(client);

it('should insert item into table', async () => {
  const putCmd = new PutCommand({ TableName: 'users_test', Item: { pk: '1', sk: 'jest-localstack-preset' } });
  await docClient.send(putCmd);

  const scanCmd = new ScanCommand({ TableName: 'users_test' });
  const { Count } = 
  await docClient.send(scanCmd);

  expect(Count).toBe(1)
})
```

An example for S3

```js
const { S3Client, ListBucketsCommand} = require("@aws-sdk/client-s3");

const { localstackConfig } = require('../aws')

const client = new S3Client(localstackConfig);

it('must be create a bucket', async () => {
  const command = new ListBucketsCommand({});

  const { Buckets } =  await client.send(command);

  // console.log("TEST", Buckets)
  expect(Buckets[0].Name).toBe('examplebucket')
})
```

Usually you go to use other files, class and functions.

```js
// UserReposity.js
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { PutCommand, ScanCommand, DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({
  endpoint: process.env.AWS_DYNAMODB_ENDPOINT_URL,
});
const docClient = DynamoDBDocumentClient.from(client);

export default class UserReposity {
  static async all(props = {}) {
    const scanCmd = new ScanCommand({ TableName: 'users', ...props });
    const response = await docClient.send(scanCmd);
    
    return response;
  }

  static async save(props) {
    const putCmd = new PutCommand({
      TableName: 'users',
      ...props,
    });

    const response = await docClient.send(putCmd);
    return response;

  }
}

// UserReposity.test.js
import UserReposity from './UserReposity'

describe('UserReposity', function() {
  it('should insert item into repository', async () => {
    await UserReposity.save({
      Item: { pk: '1', sk: 'jest-localstack-preset' },
    })

    const { Count } = await UserReposity.all()
    expect(Count).toBe(1)
  })
})
```

In this moment, all process will be make using [LocalStack](https://github.com/localstack/localstack).

## How Its Works?

Programmatically, we start a docker container with localstack, we run all tests and then, when tests finished, we destroy all containers related

## What services work?

Basically, whatever!

For more AWS Service available visit, https://docs.localstack.cloud/aws/feature-coverage/

## Debugging

You can enabled debug flag using your custom environment.

| Envs                         | Type    |
| ---------------------------- | ------- |
| LOCALSTACK_DEBUG             | boolean |
| JEST_LOCALSTACK_AUTO_PULLING | boolean |

## CI (Continuous Integration)

- Github Actions, see [.github/workflows/ci](.github/workflows/ci.yml)

Simple example

```yml
name: ci

on: push

jobs:
  jest:
    name: jest
    runs-on: ubuntu-latest

    services:
      localstack:
        image: localstack/localstack

    defaults:
      run:
        working-directory: ./

    steps:
      - uses: actions/checkout@v2

      - uses: actions/cache@v2
        with:
          path: '**/node_modules'
          key: ${{ runner.os }}-modules-${{ hashFiles('**/yarn.lock') }}
          restore-keys: |
            ${{ runner.os }}-modules-

      - name: Setup NodeJS
        uses: actions/setup-node@v2
        with:
          node-version: 18.x

      - name: Install Yarn Dependencies
        run: yarn install --frozen-lockfile

      - name: Yarn Jest
        run: yarn test
        env:
          LOCALSTACK_DEBUG: true
          JEST_LOCALSTACK_AUTO_PULLING: true
```

## Disclaimer

This project is based on the amazing project https://github.com/goldsam/jest-localstack.

## Contributing

Once you've made your great commits (include tests, please):

1. Fork this repository
2. Create a topic branch - git checkout -b my_branch
3. Push to your branch - git push origin my_branch
4. Create a pull request
5. That's it!

Please respect the indentation rules and code style. And use 2 spaces, not tabs. And don't touch the version thing or distribution files; this will be made when a new version is going to be release

## License

The Dockerfile and associated scripts and documentation in this project are released under the [MIT License](LICENSE).
