const AWS = require('aws-sdk')

const { configureMockSDK } = require('@thadeu/jest-localstack-preset/aws')
configureMockSDK(AWS)
