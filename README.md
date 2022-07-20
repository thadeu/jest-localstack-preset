# jest-localstack-preset

[![ci](https://github.com/thadeu/jest-localstack-preset/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/thadeu/jest-localstack-preset/actions/workflows/ci.yml)

A simple way to do testing AWS Services and Jest, based on the amazing project https://github.com/goldsam/jest-localstack

## Usage

Install via yarn or npm

```bash
$ yarn add https://github.com/thadeu/jest-localstack-preset.git
```

or

```bash
$ npm i https://github.com/thadeu/jest-localstack-preset.git
```

Configure `jest.config.js`, adding a custom preset

```js
module.exports = {
  preset: '@thadeu/jest-localstack-preset',
  ...
}
```

Create `jest-localstack-preset` file, for example.

```js
module.exports = {
  services: ['dynamodb', 'kinesis', 's3', 'apigateway', 'lambda'],
  showLog: false,
  readyTimeout: 10000,
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

Use custom endpoint `process.env.AWS_ENDPOINT_URL` for general or specific to DynamoDB `process.env.AWS_DYNAMODB_ENDPOINT_URL` in the AWS clients in your code., for example:

```js
const AWS = require('aws-sdk')

const Table = new AWS.DynamoDB.DocumentClient({
  endpoint: process.env.AWS_DYNAMODB_ENDPOINT_URL,
})
```

So, create your tests using Jest.

An example for DynamoDB.

```js
const AWS = require('aws-sdk')

const Table = new AWS.DynamoDB.DocumentClient({
  endpoint: process.env.AWS_DYNAMODB_ENDPOINT_URL,
})

it('should insert item into table', async () => {
  await Table.put({
    TableName: 'users_test',
    Item: { pk: '1', sk: 'jest-localstack-preset' },
  }).promise()

  const { Count } = await Table.scan({ TableName: 'users_test' }).promise()
  expect(Count).toBe(1)
})
```

An example for S3

```js
const AWS = require('aws-sdk')

const s3 = new AWS.S3({
  endpoint: process.env.AWS_ENDPOINT_URL,
  s3ForcePathStyle: true,
})

it('must be create a bucket', async () => {
  await s3.createBucket({ Bucket: 'examplebucket' }).promise()

  const { Buckets } = await s3.listBuckets().promise()

  expect(Buckets.length).toBe(1)
  expect(Buckets[0].Name).toBe('examplebucket')
})
```

Usually you go to use other files, class and functions.

```js
// UserReposity.js
const AWS = require('aws-sdk')

const Table = new AWS.DynamoDB.DocumentClient({
  endpoint: process.env.AWS_DYNAMODB_ENDPOINT_URL,
  region: process.env.AWS_REGION,
})

export default class UserReposity {
  static async all(props = {}) {
    return Table.scan({ TableName: 'users', ...props }).promise()
  }

  static async save(props) {
    return Table.put({
      TableName: 'users',
      ...props,
    }).promise()
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

| Package                      | LocalStack              |
| ---------------------------- | ----------------------- |
| DEBUG=jest-localstack-preset | LOCALSTACK_DEBUG=[false | true] |

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
          node-version: 14.17.x

      - name: Install Yarn Dependencies
        run: yarn install --frozen-lockfile

      - name: Yarn Jest
        run: yarn test
        env:
          LOCALSTACK_DEBUG: true
```

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
