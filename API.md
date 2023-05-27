# cdk-hugo-pipeline

This is an AWS CDK Construct for deploying Hugo Static websites to AWS S3 behind SSL/Cloudfront with `cdk-pipelines` with having an all-in-one infrastructure-as-code deployment on AWS, meaning

- self-contained, all resources should be on AWS
- a blog with hugo and a nice theme (in my opinion)
- using cdk and cdk-pipelines running
- a monorepo with all the code components
- a local development possibility in docker
- which includes building the code in the container with build.sh to test also locally upfront
- with a development stage on a `dev.your-domain.com` subdomain

Take a look at the blog post [My blog with hugo - all on AWS](https://manuel-vogel.de/en/blog/2023-04-16-hugo-all-on-aws/) in which I write
about all the details and learnings.

## Usage

### Typescript
```ts
import { App, Stack, StackProps } from 'aws-cdk-lib';
import { HugoPipeline } from 'cdk-hugo-pipeline';

export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    new HugoPipeline(this, 'HugoPipeline', {
      TBD: 'TBD',
      domainName: 'your-domain.com'  // Domain you already have a hosted zone for
    });
}
```

## Resources / Inspiration
- [cdk-hugo-deploy](https://github.com/maafk/cdk-hugo-deploy): however we need to build the static site with hugo before locally
- [CDK-SPA-Deploy](https://github.com/nideveloper/CDK-SPA-Deploy/tree/master): same as above

# API Reference <a name="API Reference" id="api-reference"></a>



## Classes <a name="Classes" id="Classes"></a>

### Hello <a name="Hello" id="cdk-hugo-pipeline.Hello"></a>

#### Initializers <a name="Initializers" id="cdk-hugo-pipeline.Hello.Initializer"></a>

```typescript
import { Hello } from 'cdk-hugo-pipeline'

new Hello()
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#cdk-hugo-pipeline.Hello.sayHello">sayHello</a></code> | *No description.* |

---

##### `sayHello` <a name="sayHello" id="cdk-hugo-pipeline.Hello.sayHello"></a>

```typescript
public sayHello(): string
```





