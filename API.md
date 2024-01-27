# cdk-hugo-pipeline
[![cdk-constructs: experimental](https://img.shields.io/badge/cdk--constructs-experimental-yellow.svg)](https://constructs.dev/packages/@mavogel/cdk-hugo-pipeline)
[![npm version](https://img.shields.io/npm/v/@mavogel/cdk-hugo-pipeline)](https://www.npmjs.com/package/@mavogel/cdk-hugo-pipeline)

This is an AWS CDK Construct for deploying Hugo Static websites to AWS S3 behind SSL/Cloudfront with `cdk-pipelines`, having an all-in-one infrastructure-as-code deployment on AWS, meaning

- self-contained, all resources should be on AWS
- a blog with `hugo` and a nice theme (in my opinion)
- using `cdk` and [cdk-pipelines](https://docs.aws.amazon.com/cdk/v2/guide/cdk_pipeline.html) running
- a monorepo with all the code components
- with a development stage on a `dev.your-domain.com` subdomain

Take a look at the blog post [My blog with hugo - all on AWS](https://manuel-vogel.de/post/2023-04-16-hugo-all-on-aws/) in which I write
about all the details and learnings.

## Prerequisites
1. binaries
```sh
brew install node@16 hugo docker
```
2. a `Route53 Hosted Zone` for `your-domain.com` in the AWS account you deploy into.

If you use [hugo modules](https://gohugo.io/hugo-modules/) add them as git submodules in the `themes` directory, so they can be pulled by the same git command in the `codepipeline`.

## Usage
In this demo case, we will use the `blist` theme: https://github.com/apvarun/blist-hugo-theme, however you can use any other hugo theme. Note, that you need to adapt the branch of the theme you use.

### With a projen template (recommended)
and the [blist](https://github.com/apvarun/blist-hugo-theme) theme.
```sh
mkdir my-blog && cd my-blog

npx projen new \
    --from @mavogel/projen-cdk-hugo-pipeline@~0 \
    --domain your-domain.com \
    --projenrc-ts

npm --prefix blog install
# and start the development server on http://localhost:1313
npm run dev
```


### By hand (more flexible)
<details>
  <summary>Click me</summary>

#### Set up the repository
```sh
# create the surrounding cdk-app
npx projen new awscdk-app-ts
# add the desired hugo template into the 'blog' folder
git submodule add https://github.com/apvarun/blist-hugo-theme.git blog/themes/blist
# add fixed version to hugo template in the .gitmodules file
git submodule set-branch --branch v2.1.0 blog/themes/blist
```
#### Configure the repository
depending on the theme you use (here [blist](https://github.com/apvarun/blist-hugo-theme))
1. copy the example site
```sh
cp -r blog/themes/blist/exampleSite/*  blog/
```
2. fix the config URLs as we need 2 stages: development & production. **Note**: internally the modules has the convention of a `public-development` & `public-production` output folder for the hugo build.
```sh
# create the directories
mkdir -p blog/config/_default blog/config/development blog/config/production
# and move the standard config in the _default folder
mv blog/config.toml blog/config/_default/config.toml
```
3. adapt the config files
```sh
## file: blog/config/development/config.toml
cat << EOF > blog/config/development/config.toml
baseurl = "https://dev.your-domain.com"
publishDir = "public-development"
EOF

cat << EOF > blog/config/production/config.toml
## file: blog/config/production/config.toml
baseurl = "https://your-domain.com"
publishDir = "public-production"
EOF
```
4. ignore the output folders in the file `blog/.gitignore`
```sh
cat << EOF >> blog/.gitignore
public-*
resources/_gen
node_modules
.DS_Store
.hugo_build.lock
EOF
```
5. additionally copy `package.jsons`. **Note**: this depends on your theme
```sh
cp blog/themes/blist/package.json blog/package.json
cp blog/themes/blist/package-lock.json blog/package-lock.json
```
6. *Optional*: add the script to the `.projenrc.ts`. **Note**: the command depends on your theme as well
```ts
project.addScripts({
  dev: 'npm --prefix blog run start',
  # below is the general commands
  # dev: 'cd blog && hugo server --watch --buildFuture --cleanDestinationDir --disableFastRender',
});
```
and update the project via the following command
```sh
npm run projen
```
#### Use Typescript and deploy to your AWS account
Add this to the the `main.ts` file
```ts
import { App, Stack, StackProps } from 'aws-cdk-lib';
import { HugoPipeline } from '@mavogel/cdk-hugo-pipeline';

export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // we only need 1 stack as it creates dev and prod stage in the pipeline
    new HugoPipeline(this, 'my-blog', {
      domainName: 'your-domain.com', // <- adapt here
    });
}
```
and adapt the `main.test.ts` (yes, known issue. See [#40](https://github.com/MV-Consulting/cdk-hugo-pipeline/issues/40))

```ts
test('Snapshot', () => {
  expect(true).toBe(true);
});
```

which has a `Route53 Hosted Zone` for `your-domain.com`:
</details>

### Deploy it
```sh
# build it locally via
npm run build
# deploy the repository and the pipeline once via
npm run deploy
```
1. This will create the `codecommit` repository and the `codepipeline`. The pipeline will fail first, so now commit the code.
```sh
# add the remote, e.g. via GRPC http
git remote add origin codecommit::<aws-region>://your-blog
# rename the branch to master (wlll fix this)
git branch -m master main
# push the code
git push origin master
```
2. ... wait until the pipeline has deployed to the `dev stage`, go to your url `dev.your-comain.com`, enter the basic auth credentials (default: `john:doe`) and look at you beautiful blog :tada:

## Customizations
### Redirects
You can add customizations such as `HTTP 301` redirects , for example
1. from `/talks/` to `/works/`:
  1. from `https://your-domain.com/talks/2024-01-24-my-talk`
  2. to   `https://your-domain.com/works/2024-01-24-my-talk`
2. or more complex ones `/post/2024-01-25-my-blog/gallery/my-image.webp` to `/images/2024-01-25-my-blog/my-image.webp`, which is represented by the regexp `'/(\.\*)(\\\/post\\\/)(\.\*)(\\\/gallery\\\/)(\.\*)/'` and capture group `'$1/images/$3/$5'`. Here as full example:
  1. from `https://your-domain.com/post/2024-01-25-my-blog/gallery/my-image.webp`
  2. to   `https://your-domain.com/images/2024-01-25-my-blog/my-image.webp`

```ts
export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Note: test you regex upfront
    // here https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace
    // an escape them.

    new HugoPipeline(this, 'my-blog', {
      domainName: 'your-domain.com', // <- adapt here
      cloudfrontRedirectReplacements: { // <- all regexp need to be escaped!
        '/\\\/talks\\\//': '/works/',  // /talks/ -> /\\\/talks\\\//
        // /(.*)(\/post\/)(.*)(\/gallery\/)(.*)/
        '/(\.\*)(\\\/post\\\/)(\.\*)(\\\/gallery\\\/)(\.\*)/': '$1/images/$3/$5',
      },
    });
}
```
However, you can also pass in a whole custom functions as the next section shows.

### Custom Cloudfront function
For the `VIEWER_REQUEST`, where you can also achieve `Basic Auth` or redirects the way you want

```ts
export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const customCfFunctionCode = `
function handler(event) {
    var request = event.request;
    var uri = request.uri;
    var authHeaders = request.headers.authorization;

    var regexes = [/\/talks\//, /\/post\//];

    if (regexes.some(regex => regex.test(request.uri))) {
        request.uri = request.uri.replace(/\/talks\//, '/works/');
        request.uri = request.uri.replace(/\/post\//, '/posts/');

        var response = {
            statusCode: 301,
            statusDescription: "Moved Permanently",
            headers:
                { "location": { "value": request.uri } }
        }
        return response;
    }

    var expected = "Basic am9objpkb2U=";

    if (authHeaders && authHeaders.value === expected) {
        if (uri.endsWith('/')) {
            request.uri += 'index.html';
        }
        else if (!uri.includes('.')) {
            request.uri += '/index.html';
        }
        return request;
    }

    var response = {
        statusCode: 401,
        statusDescription: "Unauthorized",
        headers: {
            "www-authenticate": {
                value: 'Basic realm="Enter credentials for this super secure site"',
            },
        },
    };

    return response;
}
`
    // we do the escapes here so it passed in correctly
    const escaptedtestCfFunctionCode = customCfFunctionCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    new HugoPipeline(this, 'my-blog', {
      domainName: 'your-domain.com', // <- adapt here
      // Note: keep in sync with the basic auth defined in the function
      // echo -n "john:doe"|base64 -> 'am9objpkb2U='
      basicAuthUsername: 'john',
      basicAuthPassword: 'doe',
      cloudfrontCustomFunctionCode: cloudfront.FunctionCode.fromInline(escaptedtestCfFunctionCode),
    });
}
```

## Known issues
- If with `npm test` you get the error `docker exited with status 1`,
  - then clean the docker layers and re-run the tests via `docker system prune -f`
  - and if it happens in `codebuild`, re-run the build
## Open todos
- [ ] a local development possibility in `docker`

## Resources / Inspiration
- [cdk-hugo-deploy](https://github.com/maafk/cdk-hugo-deploy): however here you need to build the static site with `hugo` before locally
- [CDK-SPA-Deploy](https://github.com/nideveloper/CDK-SPA-Deploy/tree/master): same as above

# API Reference <a name="API Reference" id="api-reference"></a>

## Constructs <a name="Constructs" id="Constructs"></a>

### HugoHosting <a name="HugoHosting" id="@mavogel/cdk-hugo-pipeline.HugoHosting"></a>

#### Initializers <a name="Initializers" id="@mavogel/cdk-hugo-pipeline.HugoHosting.Initializer"></a>

```typescript
import { HugoHosting } from '@mavogel/cdk-hugo-pipeline'

new HugoHosting(scope: Construct, id: string, props: HugoHostingProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHosting.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHosting.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHosting.Initializer.parameter.props">props</a></code> | <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingProps">HugoHostingProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="@mavogel/cdk-hugo-pipeline.HugoHosting.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="@mavogel/cdk-hugo-pipeline.HugoHosting.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="@mavogel/cdk-hugo-pipeline.HugoHosting.Initializer.parameter.props"></a>

- *Type:* <a href="#@mavogel/cdk-hugo-pipeline.HugoHostingProps">HugoHostingProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHosting.toString">toString</a></code> | Returns a string representation of this construct. |

---

##### `toString` <a name="toString" id="@mavogel/cdk-hugo-pipeline.HugoHosting.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHosting.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |

---

##### ~~`isConstruct`~~ <a name="isConstruct" id="@mavogel/cdk-hugo-pipeline.HugoHosting.isConstruct"></a>

```typescript
import { HugoHosting } from '@mavogel/cdk-hugo-pipeline'

HugoHosting.isConstruct(x: any)
```

Checks if `x` is a construct.

###### `x`<sup>Required</sup> <a name="x" id="@mavogel/cdk-hugo-pipeline.HugoHosting.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHosting.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHosting.property.buildStage">buildStage</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHosting.property.domainName">domainName</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHosting.property.siteDomain">siteDomain</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHosting.property.siteSubDomain">siteSubDomain</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHosting.property.staticSiteURL">staticSiteURL</a></code> | <code>aws-cdk-lib.CfnOutput</code> | *No description.* |

---

##### `node`<sup>Required</sup> <a name="node" id="@mavogel/cdk-hugo-pipeline.HugoHosting.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `buildStage`<sup>Required</sup> <a name="buildStage" id="@mavogel/cdk-hugo-pipeline.HugoHosting.property.buildStage"></a>

```typescript
public readonly buildStage: string;
```

- *Type:* string

---

##### `domainName`<sup>Required</sup> <a name="domainName" id="@mavogel/cdk-hugo-pipeline.HugoHosting.property.domainName"></a>

```typescript
public readonly domainName: string;
```

- *Type:* string

---

##### `siteDomain`<sup>Required</sup> <a name="siteDomain" id="@mavogel/cdk-hugo-pipeline.HugoHosting.property.siteDomain"></a>

```typescript
public readonly siteDomain: string;
```

- *Type:* string

---

##### `siteSubDomain`<sup>Required</sup> <a name="siteSubDomain" id="@mavogel/cdk-hugo-pipeline.HugoHosting.property.siteSubDomain"></a>

```typescript
public readonly siteSubDomain: string;
```

- *Type:* string

---

##### `staticSiteURL`<sup>Required</sup> <a name="staticSiteURL" id="@mavogel/cdk-hugo-pipeline.HugoHosting.property.staticSiteURL"></a>

```typescript
public readonly staticSiteURL: CfnOutput;
```

- *Type:* aws-cdk-lib.CfnOutput

---


### HugoHostingStack <a name="HugoHostingStack" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack"></a>

#### Initializers <a name="Initializers" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.Initializer"></a>

```typescript
import { HugoHostingStack } from '@mavogel/cdk-hugo-pipeline'

new HugoHostingStack(scope: Construct, id: string, props: HugoHostingStackProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.Initializer.parameter.props">props</a></code> | <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStackProps">HugoHostingStackProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.Initializer.parameter.props"></a>

- *Type:* <a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStackProps">HugoHostingStackProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.addDependency">addDependency</a></code> | Add a dependency between this stack and another stack. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.addMetadata">addMetadata</a></code> | Adds an arbitary key-value pair, with information you want to record about the stack. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.addTransform">addTransform</a></code> | Add a Transform to this stack. A Transform is a macro that AWS CloudFormation uses to process your template. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.exportStringListValue">exportStringListValue</a></code> | Create a CloudFormation Export for a string list value. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.exportValue">exportValue</a></code> | Create a CloudFormation Export for a string value. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.formatArn">formatArn</a></code> | Creates an ARN from components. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.getLogicalId">getLogicalId</a></code> | Allocates a stack-unique CloudFormation-compatible logical identity for a specific resource. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.regionalFact">regionalFact</a></code> | Look up a fact value for the given fact for the region of this stack. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.renameLogicalId">renameLogicalId</a></code> | Rename a generated logical identities. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.reportMissingContextKey">reportMissingContextKey</a></code> | Indicate that a context key was expected. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.resolve">resolve</a></code> | Resolve a tokenized value in the context of the current stack. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.splitArn">splitArn</a></code> | Splits the provided ARN into its components. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.toJsonString">toJsonString</a></code> | Convert an object, potentially containing tokens, to a JSON string. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.toYamlString">toYamlString</a></code> | Convert an object, potentially containing tokens, to a YAML string. |

---

##### `toString` <a name="toString" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `addDependency` <a name="addDependency" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.addDependency"></a>

```typescript
public addDependency(target: Stack, reason?: string): void
```

Add a dependency between this stack and another stack.

This can be used to define dependencies between any two stacks within an
app, and also supports nested stacks.

###### `target`<sup>Required</sup> <a name="target" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.addDependency.parameter.target"></a>

- *Type:* aws-cdk-lib.Stack

---

###### `reason`<sup>Optional</sup> <a name="reason" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.addDependency.parameter.reason"></a>

- *Type:* string

---

##### `addMetadata` <a name="addMetadata" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.addMetadata"></a>

```typescript
public addMetadata(key: string, value: any): void
```

Adds an arbitary key-value pair, with information you want to record about the stack.

These get translated to the Metadata section of the generated template.

> [https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/metadata-section-structure.html](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/metadata-section-structure.html)

###### `key`<sup>Required</sup> <a name="key" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.addMetadata.parameter.key"></a>

- *Type:* string

---

###### `value`<sup>Required</sup> <a name="value" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.addMetadata.parameter.value"></a>

- *Type:* any

---

##### `addTransform` <a name="addTransform" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.addTransform"></a>

```typescript
public addTransform(transform: string): void
```

Add a Transform to this stack. A Transform is a macro that AWS CloudFormation uses to process your template.

Duplicate values are removed when stack is synthesized.

> [https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/transform-section-structure.html](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/transform-section-structure.html)

*Example*

```typescript
declare const stack: Stack;

stack.addTransform('AWS::Serverless-2016-10-31')
```


###### `transform`<sup>Required</sup> <a name="transform" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.addTransform.parameter.transform"></a>

- *Type:* string

The transform to add.

---

##### `exportStringListValue` <a name="exportStringListValue" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.exportStringListValue"></a>

```typescript
public exportStringListValue(exportedValue: any, options?: ExportValueOptions): string[]
```

Create a CloudFormation Export for a string list value.

Returns a string list representing the corresponding `Fn.importValue()`
expression for this Export. The export expression is automatically wrapped with an
`Fn::Join` and the import value with an `Fn::Split`, since CloudFormation can only
export strings. You can control the name for the export by passing the `name` option.

If you don't supply a value for `name`, the value you're exporting must be
a Resource attribute (for example: `bucket.bucketName`) and it will be
given the same name as the automatic cross-stack reference that would be created
if you used the attribute in another Stack.

One of the uses for this method is to *remove* the relationship between
two Stacks established by automatic cross-stack references. It will
temporarily ensure that the CloudFormation Export still exists while you
remove the reference from the consuming stack. After that, you can remove
the resource and the manual export.

See `exportValue` for an example of this process.

###### `exportedValue`<sup>Required</sup> <a name="exportedValue" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.exportStringListValue.parameter.exportedValue"></a>

- *Type:* any

---

###### `options`<sup>Optional</sup> <a name="options" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.exportStringListValue.parameter.options"></a>

- *Type:* aws-cdk-lib.ExportValueOptions

---

##### `exportValue` <a name="exportValue" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.exportValue"></a>

```typescript
public exportValue(exportedValue: any, options?: ExportValueOptions): string
```

Create a CloudFormation Export for a string value.

Returns a string representing the corresponding `Fn.importValue()`
expression for this Export. You can control the name for the export by
passing the `name` option.

If you don't supply a value for `name`, the value you're exporting must be
a Resource attribute (for example: `bucket.bucketName`) and it will be
given the same name as the automatic cross-stack reference that would be created
if you used the attribute in another Stack.

One of the uses for this method is to *remove* the relationship between
two Stacks established by automatic cross-stack references. It will
temporarily ensure that the CloudFormation Export still exists while you
remove the reference from the consuming stack. After that, you can remove
the resource and the manual export.

## Example

Here is how the process works. Let's say there are two stacks,
`producerStack` and `consumerStack`, and `producerStack` has a bucket
called `bucket`, which is referenced by `consumerStack` (perhaps because
an AWS Lambda Function writes into it, or something like that).

It is not safe to remove `producerStack.bucket` because as the bucket is being
deleted, `consumerStack` might still be using it.

Instead, the process takes two deployments:

### Deployment 1: break the relationship

- Make sure `consumerStack` no longer references `bucket.bucketName` (maybe the consumer
  stack now uses its own bucket, or it writes to an AWS DynamoDB table, or maybe you just
  remove the Lambda Function altogether).
- In the `ProducerStack` class, call `this.exportValue(this.bucket.bucketName)`. This
  will make sure the CloudFormation Export continues to exist while the relationship
  between the two stacks is being broken.
- Deploy (this will effectively only change the `consumerStack`, but it's safe to deploy both).

### Deployment 2: remove the bucket resource

- You are now free to remove the `bucket` resource from `producerStack`.
- Don't forget to remove the `exportValue()` call as well.
- Deploy again (this time only the `producerStack` will be changed -- the bucket will be deleted).

###### `exportedValue`<sup>Required</sup> <a name="exportedValue" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.exportValue.parameter.exportedValue"></a>

- *Type:* any

---

###### `options`<sup>Optional</sup> <a name="options" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.exportValue.parameter.options"></a>

- *Type:* aws-cdk-lib.ExportValueOptions

---

##### `formatArn` <a name="formatArn" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.formatArn"></a>

```typescript
public formatArn(components: ArnComponents): string
```

Creates an ARN from components.

If `partition`, `region` or `account` are not specified, the stack's
partition, region and account will be used.

If any component is the empty string, an empty string will be inserted
into the generated ARN at the location that component corresponds to.

The ARN will be formatted as follows:

  arn:{partition}:{service}:{region}:{account}:{resource}{sep}{resource-name}

The required ARN pieces that are omitted will be taken from the stack that
the 'scope' is attached to. If all ARN pieces are supplied, the supplied scope
can be 'undefined'.

###### `components`<sup>Required</sup> <a name="components" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.formatArn.parameter.components"></a>

- *Type:* aws-cdk-lib.ArnComponents

---

##### `getLogicalId` <a name="getLogicalId" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.getLogicalId"></a>

```typescript
public getLogicalId(element: CfnElement): string
```

Allocates a stack-unique CloudFormation-compatible logical identity for a specific resource.

This method is called when a `CfnElement` is created and used to render the
initial logical identity of resources. Logical ID renames are applied at
this stage.

This method uses the protected method `allocateLogicalId` to render the
logical ID for an element. To modify the naming scheme, extend the `Stack`
class and override this method.

###### `element`<sup>Required</sup> <a name="element" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.getLogicalId.parameter.element"></a>

- *Type:* aws-cdk-lib.CfnElement

The CloudFormation element for which a logical identity is needed.

---

##### `regionalFact` <a name="regionalFact" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.regionalFact"></a>

```typescript
public regionalFact(factName: string, defaultValue?: string): string
```

Look up a fact value for the given fact for the region of this stack.

Will return a definite value only if the region of the current stack is resolved.
If not, a lookup map will be added to the stack and the lookup will be done at
CDK deployment time.

What regions will be included in the lookup map is controlled by the
`@aws-cdk/core:target-partitions` context value: it must be set to a list
of partitions, and only regions from the given partitions will be included.
If no such context key is set, all regions will be included.

This function is intended to be used by construct library authors. Application
builders can rely on the abstractions offered by construct libraries and do
not have to worry about regional facts.

If `defaultValue` is not given, it is an error if the fact is unknown for
the given region.

###### `factName`<sup>Required</sup> <a name="factName" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.regionalFact.parameter.factName"></a>

- *Type:* string

---

###### `defaultValue`<sup>Optional</sup> <a name="defaultValue" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.regionalFact.parameter.defaultValue"></a>

- *Type:* string

---

##### `renameLogicalId` <a name="renameLogicalId" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.renameLogicalId"></a>

```typescript
public renameLogicalId(oldId: string, newId: string): void
```

Rename a generated logical identities.

To modify the naming scheme strategy, extend the `Stack` class and
override the `allocateLogicalId` method.

###### `oldId`<sup>Required</sup> <a name="oldId" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.renameLogicalId.parameter.oldId"></a>

- *Type:* string

---

###### `newId`<sup>Required</sup> <a name="newId" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.renameLogicalId.parameter.newId"></a>

- *Type:* string

---

##### `reportMissingContextKey` <a name="reportMissingContextKey" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.reportMissingContextKey"></a>

```typescript
public reportMissingContextKey(report: MissingContext): void
```

Indicate that a context key was expected.

Contains instructions which will be emitted into the cloud assembly on how
the key should be supplied.

###### `report`<sup>Required</sup> <a name="report" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.reportMissingContextKey.parameter.report"></a>

- *Type:* aws-cdk-lib.cloud_assembly_schema.MissingContext

The set of parameters needed to obtain the context.

---

##### `resolve` <a name="resolve" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.resolve"></a>

```typescript
public resolve(obj: any): any
```

Resolve a tokenized value in the context of the current stack.

###### `obj`<sup>Required</sup> <a name="obj" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.resolve.parameter.obj"></a>

- *Type:* any

---

##### `splitArn` <a name="splitArn" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.splitArn"></a>

```typescript
public splitArn(arn: string, arnFormat: ArnFormat): ArnComponents
```

Splits the provided ARN into its components.

Works both if 'arn' is a string like 'arn:aws:s3:::bucket',
and a Token representing a dynamic CloudFormation expression
(in which case the returned components will also be dynamic CloudFormation expressions,
encoded as Tokens).

###### `arn`<sup>Required</sup> <a name="arn" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.splitArn.parameter.arn"></a>

- *Type:* string

the ARN to split into its components.

---

###### `arnFormat`<sup>Required</sup> <a name="arnFormat" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.splitArn.parameter.arnFormat"></a>

- *Type:* aws-cdk-lib.ArnFormat

the expected format of 'arn' - depends on what format the service 'arn' represents uses.

---

##### `toJsonString` <a name="toJsonString" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.toJsonString"></a>

```typescript
public toJsonString(obj: any, space?: number): string
```

Convert an object, potentially containing tokens, to a JSON string.

###### `obj`<sup>Required</sup> <a name="obj" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.toJsonString.parameter.obj"></a>

- *Type:* any

---

###### `space`<sup>Optional</sup> <a name="space" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.toJsonString.parameter.space"></a>

- *Type:* number

---

##### `toYamlString` <a name="toYamlString" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.toYamlString"></a>

```typescript
public toYamlString(obj: any): string
```

Convert an object, potentially containing tokens, to a YAML string.

###### `obj`<sup>Required</sup> <a name="obj" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.toYamlString.parameter.obj"></a>

- *Type:* any

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.isStack">isStack</a></code> | Return whether the given object is a Stack. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.of">of</a></code> | Looks up the first stack scope in which `construct` is defined. |

---

##### ~~`isConstruct`~~ <a name="isConstruct" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.isConstruct"></a>

```typescript
import { HugoHostingStack } from '@mavogel/cdk-hugo-pipeline'

HugoHostingStack.isConstruct(x: any)
```

Checks if `x` is a construct.

###### `x`<sup>Required</sup> <a name="x" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

##### `isStack` <a name="isStack" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.isStack"></a>

```typescript
import { HugoHostingStack } from '@mavogel/cdk-hugo-pipeline'

HugoHostingStack.isStack(x: any)
```

Return whether the given object is a Stack.

We do attribute detection since we can't reliably use 'instanceof'.

###### `x`<sup>Required</sup> <a name="x" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.isStack.parameter.x"></a>

- *Type:* any

---

##### `of` <a name="of" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.of"></a>

```typescript
import { HugoHostingStack } from '@mavogel/cdk-hugo-pipeline'

HugoHostingStack.of(construct: IConstruct)
```

Looks up the first stack scope in which `construct` is defined.

Fails if there is no stack up the tree.

###### `construct`<sup>Required</sup> <a name="construct" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.of.parameter.construct"></a>

- *Type:* constructs.IConstruct

The construct to start the search from.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.account">account</a></code> | <code>string</code> | The AWS account into which this stack will be deployed. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.artifactId">artifactId</a></code> | <code>string</code> | The ID of the cloud assembly artifact for this stack. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.availabilityZones">availabilityZones</a></code> | <code>string[]</code> | Returns the list of AZs that are available in the AWS environment (account/region) associated with this stack. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.bundlingRequired">bundlingRequired</a></code> | <code>boolean</code> | Indicates whether the stack requires bundling or not. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.dependencies">dependencies</a></code> | <code>aws-cdk-lib.Stack[]</code> | Return the stacks this stack depends on. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.environment">environment</a></code> | <code>string</code> | The environment coordinates in which this stack is deployed. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.nested">nested</a></code> | <code>boolean</code> | Indicates if this is a nested stack, in which case `parentStack` will include a reference to it's parent. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.notificationArns">notificationArns</a></code> | <code>string[]</code> | Returns the list of notification Amazon Resource Names (ARNs) for the current stack. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.partition">partition</a></code> | <code>string</code> | The partition in which this stack is defined. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.region">region</a></code> | <code>string</code> | The AWS region into which this stack will be deployed (e.g. `us-west-2`). |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.stackId">stackId</a></code> | <code>string</code> | The ID of the stack. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.stackName">stackName</a></code> | <code>string</code> | The concrete CloudFormation physical stack name. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.synthesizer">synthesizer</a></code> | <code>aws-cdk-lib.IStackSynthesizer</code> | Synthesis method for this stack. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.tags">tags</a></code> | <code>aws-cdk-lib.TagManager</code> | Tags to be applied to the stack. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.templateFile">templateFile</a></code> | <code>string</code> | The name of the CloudFormation template file emitted to the output directory during synthesis. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.templateOptions">templateOptions</a></code> | <code>aws-cdk-lib.ITemplateOptions</code> | Options for CloudFormation template (like version, transform, description). |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.urlSuffix">urlSuffix</a></code> | <code>string</code> | The Amazon domain suffix for the region in which this stack is defined. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.nestedStackParent">nestedStackParent</a></code> | <code>aws-cdk-lib.Stack</code> | If this is a nested stack, returns it's parent stack. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.nestedStackResource">nestedStackResource</a></code> | <code>aws-cdk-lib.CfnResource</code> | If this is a nested stack, this represents its `AWS::CloudFormation::Stack` resource. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.terminationProtection">terminationProtection</a></code> | <code>boolean</code> | Whether termination protection is enabled for this stack. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.staticSiteURL">staticSiteURL</a></code> | <code>aws-cdk-lib.CfnOutput</code> | *No description.* |

---

##### `node`<sup>Required</sup> <a name="node" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `account`<sup>Required</sup> <a name="account" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.account"></a>

```typescript
public readonly account: string;
```

- *Type:* string

The AWS account into which this stack will be deployed.

This value is resolved according to the following rules:

1. The value provided to `env.account` when the stack is defined. This can
   either be a concrete account (e.g. `585695031111`) or the
   `Aws.ACCOUNT_ID` token.
3. `Aws.ACCOUNT_ID`, which represents the CloudFormation intrinsic reference
   `{ "Ref": "AWS::AccountId" }` encoded as a string token.

Preferably, you should use the return value as an opaque string and not
attempt to parse it to implement your logic. If you do, you must first
check that it is a concrete value an not an unresolved token. If this
value is an unresolved token (`Token.isUnresolved(stack.account)` returns
`true`), this implies that the user wishes that this stack will synthesize
into a **account-agnostic template**. In this case, your code should either
fail (throw an error, emit a synth error using `Annotations.of(construct).addError()`) or
implement some other region-agnostic behavior.

---

##### `artifactId`<sup>Required</sup> <a name="artifactId" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.artifactId"></a>

```typescript
public readonly artifactId: string;
```

- *Type:* string

The ID of the cloud assembly artifact for this stack.

---

##### `availabilityZones`<sup>Required</sup> <a name="availabilityZones" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.availabilityZones"></a>

```typescript
public readonly availabilityZones: string[];
```

- *Type:* string[]

Returns the list of AZs that are available in the AWS environment (account/region) associated with this stack.

If the stack is environment-agnostic (either account and/or region are
tokens), this property will return an array with 2 tokens that will resolve
at deploy-time to the first two availability zones returned from CloudFormation's
`Fn::GetAZs` intrinsic function.

If they are not available in the context, returns a set of dummy values and
reports them as missing, and let the CLI resolve them by calling EC2
`DescribeAvailabilityZones` on the target environment.

To specify a different strategy for selecting availability zones override this method.

---

##### `bundlingRequired`<sup>Required</sup> <a name="bundlingRequired" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.bundlingRequired"></a>

```typescript
public readonly bundlingRequired: boolean;
```

- *Type:* boolean

Indicates whether the stack requires bundling or not.

---

##### `dependencies`<sup>Required</sup> <a name="dependencies" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.dependencies"></a>

```typescript
public readonly dependencies: Stack[];
```

- *Type:* aws-cdk-lib.Stack[]

Return the stacks this stack depends on.

---

##### `environment`<sup>Required</sup> <a name="environment" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.environment"></a>

```typescript
public readonly environment: string;
```

- *Type:* string

The environment coordinates in which this stack is deployed.

In the form
`aws://account/region`. Use `stack.account` and `stack.region` to obtain
the specific values, no need to parse.

You can use this value to determine if two stacks are targeting the same
environment.

If either `stack.account` or `stack.region` are not concrete values (e.g.
`Aws.ACCOUNT_ID` or `Aws.REGION`) the special strings `unknown-account` and/or
`unknown-region` will be used respectively to indicate this stack is
region/account-agnostic.

---

##### `nested`<sup>Required</sup> <a name="nested" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.nested"></a>

```typescript
public readonly nested: boolean;
```

- *Type:* boolean

Indicates if this is a nested stack, in which case `parentStack` will include a reference to it's parent.

---

##### `notificationArns`<sup>Required</sup> <a name="notificationArns" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.notificationArns"></a>

```typescript
public readonly notificationArns: string[];
```

- *Type:* string[]

Returns the list of notification Amazon Resource Names (ARNs) for the current stack.

---

##### `partition`<sup>Required</sup> <a name="partition" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.partition"></a>

```typescript
public readonly partition: string;
```

- *Type:* string

The partition in which this stack is defined.

---

##### `region`<sup>Required</sup> <a name="region" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.region"></a>

```typescript
public readonly region: string;
```

- *Type:* string

The AWS region into which this stack will be deployed (e.g. `us-west-2`).

This value is resolved according to the following rules:

1. The value provided to `env.region` when the stack is defined. This can
   either be a concrete region (e.g. `us-west-2`) or the `Aws.REGION`
   token.
3. `Aws.REGION`, which is represents the CloudFormation intrinsic reference
   `{ "Ref": "AWS::Region" }` encoded as a string token.

Preferably, you should use the return value as an opaque string and not
attempt to parse it to implement your logic. If you do, you must first
check that it is a concrete value an not an unresolved token. If this
value is an unresolved token (`Token.isUnresolved(stack.region)` returns
`true`), this implies that the user wishes that this stack will synthesize
into a **region-agnostic template**. In this case, your code should either
fail (throw an error, emit a synth error using `Annotations.of(construct).addError()`) or
implement some other region-agnostic behavior.

---

##### `stackId`<sup>Required</sup> <a name="stackId" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.stackId"></a>

```typescript
public readonly stackId: string;
```

- *Type:* string

The ID of the stack.

---

*Example*

```typescript
// After resolving, looks like
'arn:aws:cloudformation:us-west-2:123456789012:stack/teststack/51af3dc0-da77-11e4-872e-1234567db123'
```


##### `stackName`<sup>Required</sup> <a name="stackName" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.stackName"></a>

```typescript
public readonly stackName: string;
```

- *Type:* string

The concrete CloudFormation physical stack name.

This is either the name defined explicitly in the `stackName` prop or
allocated based on the stack's location in the construct tree. Stacks that
are directly defined under the app use their construct `id` as their stack
name. Stacks that are defined deeper within the tree will use a hashed naming
scheme based on the construct path to ensure uniqueness.

If you wish to obtain the deploy-time AWS::StackName intrinsic,
you can use `Aws.STACK_NAME` directly.

---

##### `synthesizer`<sup>Required</sup> <a name="synthesizer" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.synthesizer"></a>

```typescript
public readonly synthesizer: IStackSynthesizer;
```

- *Type:* aws-cdk-lib.IStackSynthesizer

Synthesis method for this stack.

---

##### `tags`<sup>Required</sup> <a name="tags" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.tags"></a>

```typescript
public readonly tags: TagManager;
```

- *Type:* aws-cdk-lib.TagManager

Tags to be applied to the stack.

---

##### `templateFile`<sup>Required</sup> <a name="templateFile" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.templateFile"></a>

```typescript
public readonly templateFile: string;
```

- *Type:* string

The name of the CloudFormation template file emitted to the output directory during synthesis.

Example value: `MyStack.template.json`

---

##### `templateOptions`<sup>Required</sup> <a name="templateOptions" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.templateOptions"></a>

```typescript
public readonly templateOptions: ITemplateOptions;
```

- *Type:* aws-cdk-lib.ITemplateOptions

Options for CloudFormation template (like version, transform, description).

---

##### `urlSuffix`<sup>Required</sup> <a name="urlSuffix" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.urlSuffix"></a>

```typescript
public readonly urlSuffix: string;
```

- *Type:* string

The Amazon domain suffix for the region in which this stack is defined.

---

##### `nestedStackParent`<sup>Optional</sup> <a name="nestedStackParent" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.nestedStackParent"></a>

```typescript
public readonly nestedStackParent: Stack;
```

- *Type:* aws-cdk-lib.Stack

If this is a nested stack, returns it's parent stack.

---

##### `nestedStackResource`<sup>Optional</sup> <a name="nestedStackResource" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.nestedStackResource"></a>

```typescript
public readonly nestedStackResource: CfnResource;
```

- *Type:* aws-cdk-lib.CfnResource

If this is a nested stack, this represents its `AWS::CloudFormation::Stack` resource.

`undefined` for top-level (non-nested) stacks.

---

##### `terminationProtection`<sup>Optional</sup> <a name="terminationProtection" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.terminationProtection"></a>

```typescript
public readonly terminationProtection: boolean;
```

- *Type:* boolean

Whether termination protection is enabled for this stack.

---

##### `staticSiteURL`<sup>Required</sup> <a name="staticSiteURL" id="@mavogel/cdk-hugo-pipeline.HugoHostingStack.property.staticSiteURL"></a>

```typescript
public readonly staticSiteURL: CfnOutput;
```

- *Type:* aws-cdk-lib.CfnOutput

---


### HugoPageStage <a name="HugoPageStage" id="@mavogel/cdk-hugo-pipeline.HugoPageStage"></a>

#### Initializers <a name="Initializers" id="@mavogel/cdk-hugo-pipeline.HugoPageStage.Initializer"></a>

```typescript
import { HugoPageStage } from '@mavogel/cdk-hugo-pipeline'

new HugoPageStage(scope: Construct, id: string, props: HugoPageStageProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPageStage.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPageStage.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPageStage.Initializer.parameter.props">props</a></code> | <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPageStageProps">HugoPageStageProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="@mavogel/cdk-hugo-pipeline.HugoPageStage.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="@mavogel/cdk-hugo-pipeline.HugoPageStage.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="@mavogel/cdk-hugo-pipeline.HugoPageStage.Initializer.parameter.props"></a>

- *Type:* <a href="#@mavogel/cdk-hugo-pipeline.HugoPageStageProps">HugoPageStageProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPageStage.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPageStage.synth">synth</a></code> | Synthesize this stage into a cloud assembly. |

---

##### `toString` <a name="toString" id="@mavogel/cdk-hugo-pipeline.HugoPageStage.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `synth` <a name="synth" id="@mavogel/cdk-hugo-pipeline.HugoPageStage.synth"></a>

```typescript
public synth(options?: StageSynthesisOptions): CloudAssembly
```

Synthesize this stage into a cloud assembly.

Once an assembly has been synthesized, it cannot be modified. Subsequent
calls will return the same assembly.

###### `options`<sup>Optional</sup> <a name="options" id="@mavogel/cdk-hugo-pipeline.HugoPageStage.synth.parameter.options"></a>

- *Type:* aws-cdk-lib.StageSynthesisOptions

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPageStage.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPageStage.isStage">isStage</a></code> | Test whether the given construct is a stage. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPageStage.of">of</a></code> | Return the stage this construct is contained with, if available. |

---

##### ~~`isConstruct`~~ <a name="isConstruct" id="@mavogel/cdk-hugo-pipeline.HugoPageStage.isConstruct"></a>

```typescript
import { HugoPageStage } from '@mavogel/cdk-hugo-pipeline'

HugoPageStage.isConstruct(x: any)
```

Checks if `x` is a construct.

###### `x`<sup>Required</sup> <a name="x" id="@mavogel/cdk-hugo-pipeline.HugoPageStage.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

##### `isStage` <a name="isStage" id="@mavogel/cdk-hugo-pipeline.HugoPageStage.isStage"></a>

```typescript
import { HugoPageStage } from '@mavogel/cdk-hugo-pipeline'

HugoPageStage.isStage(x: any)
```

Test whether the given construct is a stage.

###### `x`<sup>Required</sup> <a name="x" id="@mavogel/cdk-hugo-pipeline.HugoPageStage.isStage.parameter.x"></a>

- *Type:* any

---

##### `of` <a name="of" id="@mavogel/cdk-hugo-pipeline.HugoPageStage.of"></a>

```typescript
import { HugoPageStage } from '@mavogel/cdk-hugo-pipeline'

HugoPageStage.of(construct: IConstruct)
```

Return the stage this construct is contained with, if available.

If called
on a nested stage, returns its parent.

###### `construct`<sup>Required</sup> <a name="construct" id="@mavogel/cdk-hugo-pipeline.HugoPageStage.of.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPageStage.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPageStage.property.artifactId">artifactId</a></code> | <code>string</code> | Artifact ID of the assembly if it is a nested stage. The root stage (app) will return an empty string. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPageStage.property.assetOutdir">assetOutdir</a></code> | <code>string</code> | The cloud assembly asset output directory. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPageStage.property.outdir">outdir</a></code> | <code>string</code> | The cloud assembly output directory. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPageStage.property.policyValidationBeta1">policyValidationBeta1</a></code> | <code>aws-cdk-lib.IPolicyValidationPluginBeta1[]</code> | Validation plugins to run during synthesis. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPageStage.property.stageName">stageName</a></code> | <code>string</code> | The name of the stage. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPageStage.property.account">account</a></code> | <code>string</code> | The default account for all resources defined within this stage. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPageStage.property.parentStage">parentStage</a></code> | <code>aws-cdk-lib.Stage</code> | The parent stage or `undefined` if this is the app. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPageStage.property.region">region</a></code> | <code>string</code> | The default region for all resources defined within this stage. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPageStage.property.staticSiteURL">staticSiteURL</a></code> | <code>aws-cdk-lib.CfnOutput</code> | *No description.* |

---

##### `node`<sup>Required</sup> <a name="node" id="@mavogel/cdk-hugo-pipeline.HugoPageStage.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `artifactId`<sup>Required</sup> <a name="artifactId" id="@mavogel/cdk-hugo-pipeline.HugoPageStage.property.artifactId"></a>

```typescript
public readonly artifactId: string;
```

- *Type:* string

Artifact ID of the assembly if it is a nested stage. The root stage (app) will return an empty string.

Derived from the construct path.

---

##### `assetOutdir`<sup>Required</sup> <a name="assetOutdir" id="@mavogel/cdk-hugo-pipeline.HugoPageStage.property.assetOutdir"></a>

```typescript
public readonly assetOutdir: string;
```

- *Type:* string

The cloud assembly asset output directory.

---

##### `outdir`<sup>Required</sup> <a name="outdir" id="@mavogel/cdk-hugo-pipeline.HugoPageStage.property.outdir"></a>

```typescript
public readonly outdir: string;
```

- *Type:* string

The cloud assembly output directory.

---

##### `policyValidationBeta1`<sup>Required</sup> <a name="policyValidationBeta1" id="@mavogel/cdk-hugo-pipeline.HugoPageStage.property.policyValidationBeta1"></a>

```typescript
public readonly policyValidationBeta1: IPolicyValidationPluginBeta1[];
```

- *Type:* aws-cdk-lib.IPolicyValidationPluginBeta1[]
- *Default:* no validation plugins are used

Validation plugins to run during synthesis.

If any plugin reports any violation,
synthesis will be interrupted and the report displayed to the user.

---

##### `stageName`<sup>Required</sup> <a name="stageName" id="@mavogel/cdk-hugo-pipeline.HugoPageStage.property.stageName"></a>

```typescript
public readonly stageName: string;
```

- *Type:* string

The name of the stage.

Based on names of the parent stages separated by
hypens.

---

##### `account`<sup>Optional</sup> <a name="account" id="@mavogel/cdk-hugo-pipeline.HugoPageStage.property.account"></a>

```typescript
public readonly account: string;
```

- *Type:* string

The default account for all resources defined within this stage.

---

##### `parentStage`<sup>Optional</sup> <a name="parentStage" id="@mavogel/cdk-hugo-pipeline.HugoPageStage.property.parentStage"></a>

```typescript
public readonly parentStage: Stage;
```

- *Type:* aws-cdk-lib.Stage

The parent stage or `undefined` if this is the app.

*

---

##### `region`<sup>Optional</sup> <a name="region" id="@mavogel/cdk-hugo-pipeline.HugoPageStage.property.region"></a>

```typescript
public readonly region: string;
```

- *Type:* string

The default region for all resources defined within this stage.

---

##### `staticSiteURL`<sup>Required</sup> <a name="staticSiteURL" id="@mavogel/cdk-hugo-pipeline.HugoPageStage.property.staticSiteURL"></a>

```typescript
public readonly staticSiteURL: CfnOutput;
```

- *Type:* aws-cdk-lib.CfnOutput

---


### HugoPipeline <a name="HugoPipeline" id="@mavogel/cdk-hugo-pipeline.HugoPipeline"></a>

#### Initializers <a name="Initializers" id="@mavogel/cdk-hugo-pipeline.HugoPipeline.Initializer"></a>

```typescript
import { HugoPipeline } from '@mavogel/cdk-hugo-pipeline'

new HugoPipeline(scope: Construct, id: string, props: HugoPipelineProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPipeline.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPipeline.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPipeline.Initializer.parameter.props">props</a></code> | <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPipelineProps">HugoPipelineProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="@mavogel/cdk-hugo-pipeline.HugoPipeline.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="@mavogel/cdk-hugo-pipeline.HugoPipeline.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="@mavogel/cdk-hugo-pipeline.HugoPipeline.Initializer.parameter.props"></a>

- *Type:* <a href="#@mavogel/cdk-hugo-pipeline.HugoPipelineProps">HugoPipelineProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPipeline.toString">toString</a></code> | Returns a string representation of this construct. |

---

##### `toString` <a name="toString" id="@mavogel/cdk-hugo-pipeline.HugoPipeline.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPipeline.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |

---

##### ~~`isConstruct`~~ <a name="isConstruct" id="@mavogel/cdk-hugo-pipeline.HugoPipeline.isConstruct"></a>

```typescript
import { HugoPipeline } from '@mavogel/cdk-hugo-pipeline'

HugoPipeline.isConstruct(x: any)
```

Checks if `x` is a construct.

###### `x`<sup>Required</sup> <a name="x" id="@mavogel/cdk-hugo-pipeline.HugoPipeline.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPipeline.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPipeline.property.domainName">domainName</a></code> | <code>string</code> | *No description.* |

---

##### `node`<sup>Required</sup> <a name="node" id="@mavogel/cdk-hugo-pipeline.HugoPipeline.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `domainName`<sup>Required</sup> <a name="domainName" id="@mavogel/cdk-hugo-pipeline.HugoPipeline.property.domainName"></a>

```typescript
public readonly domainName: string;
```

- *Type:* string

---


## Structs <a name="Structs" id="Structs"></a>

### HugoHostingProps <a name="HugoHostingProps" id="@mavogel/cdk-hugo-pipeline.HugoHostingProps"></a>

#### Initializer <a name="Initializer" id="@mavogel/cdk-hugo-pipeline.HugoHostingProps.Initializer"></a>

```typescript
import { HugoHostingProps } from '@mavogel/cdk-hugo-pipeline'

const hugoHostingProps: HugoHostingProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingProps.property.domainName">domainName</a></code> | <code>string</code> | Name of the domain to host the site on. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingProps.property.alpineHugoVersion">alpineHugoVersion</a></code> | <code>string</code> | The hugo version to use in the alpine docker image. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingProps.property.basicAuthPassword">basicAuthPassword</a></code> | <code>string</code> | The password for basic auth on the development site. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingProps.property.basicAuthUsername">basicAuthUsername</a></code> | <code>string</code> | The username for basic auth on the development site. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingProps.property.buildStage">buildStage</a></code> | <code>string</code> | Name of the stage to deploy to. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingProps.property.cloudfrontCustomFunctionCode">cloudfrontCustomFunctionCode</a></code> | <code>aws-cdk-lib.aws_cloudfront.FunctionCode</code> | The cloudfront custom function code. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingProps.property.cloudfrontRedirectReplacements">cloudfrontRedirectReplacements</a></code> | <code>{[ key: string ]: string}</code> | The cloudfront redirect replacements. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingProps.property.dockerImage">dockerImage</a></code> | <code>string</code> | The docker image to use to build the hugo page. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingProps.property.http403ResponsePagePath">http403ResponsePagePath</a></code> | <code>string</code> | The path to the 403 error page. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingProps.property.http404ResponsePagePath">http404ResponsePagePath</a></code> | <code>string</code> | The path to the 404 error page. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingProps.property.hugoBuildCommand">hugoBuildCommand</a></code> | <code>string</code> | The build command for the hugo site on which the '--environment' flag is appended. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingProps.property.hugoProjectPath">hugoProjectPath</a></code> | <code>string</code> | The absolute path to the hugo project. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingProps.property.s3deployAssetHash">s3deployAssetHash</a></code> | <code>string</code> | The hash to use to build or rebuild the hugo page. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingProps.property.siteSubDomain">siteSubDomain</a></code> | <code>string</code> | The subdomain to host the development site on, for example 'dev'. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingProps.property.zone">zone</a></code> | <code>aws-cdk-lib.aws_route53.HostedZone</code> | Zone the Domain Name is created in. |

---

##### `domainName`<sup>Required</sup> <a name="domainName" id="@mavogel/cdk-hugo-pipeline.HugoHostingProps.property.domainName"></a>

```typescript
public readonly domainName: string;
```

- *Type:* string

Name of the domain to host the site on.

---

##### `alpineHugoVersion`<sup>Optional</sup> <a name="alpineHugoVersion" id="@mavogel/cdk-hugo-pipeline.HugoHostingProps.property.alpineHugoVersion"></a>

```typescript
public readonly alpineHugoVersion: string;
```

- *Type:* string
- *Default:* '',  meaning the latest version. You can specify a specific version, for example '=0.106.0-r4'

The hugo version to use in the alpine docker image.

---

##### `basicAuthPassword`<sup>Optional</sup> <a name="basicAuthPassword" id="@mavogel/cdk-hugo-pipeline.HugoHostingProps.property.basicAuthPassword"></a>

```typescript
public readonly basicAuthPassword: string;
```

- *Type:* string
- *Default:* doe

The password for basic auth on the development site.

---

##### `basicAuthUsername`<sup>Optional</sup> <a name="basicAuthUsername" id="@mavogel/cdk-hugo-pipeline.HugoHostingProps.property.basicAuthUsername"></a>

```typescript
public readonly basicAuthUsername: string;
```

- *Type:* string
- *Default:* john

The username for basic auth on the development site.

---

##### `buildStage`<sup>Optional</sup> <a name="buildStage" id="@mavogel/cdk-hugo-pipeline.HugoHostingProps.property.buildStage"></a>

```typescript
public readonly buildStage: string;
```

- *Type:* string
- *Default:* production

Name of the stage to deploy to.

Should be 'development' or 'production'

---

##### `cloudfrontCustomFunctionCode`<sup>Optional</sup> <a name="cloudfrontCustomFunctionCode" id="@mavogel/cdk-hugo-pipeline.HugoHostingProps.property.cloudfrontCustomFunctionCode"></a>

```typescript
public readonly cloudfrontCustomFunctionCode: FunctionCode;
```

- *Type:* aws-cdk-lib.aws_cloudfront.FunctionCode
- *Default:* undefined

The cloudfront custom function code.

---

##### `cloudfrontRedirectReplacements`<sup>Optional</sup> <a name="cloudfrontRedirectReplacements" id="@mavogel/cdk-hugo-pipeline.HugoHostingProps.property.cloudfrontRedirectReplacements"></a>

```typescript
public readonly cloudfrontRedirectReplacements: {[ key: string ]: string};
```

- *Type:* {[ key: string ]: string}
- *Default:* {}

The cloudfront redirect replacements.

Those are string replacements for the request.uri.
Note: the replacements are regular expressions.
Note: if cloudfrontCustomFunctionCode is set, this property is ignored.

---

##### `dockerImage`<sup>Optional</sup> <a name="dockerImage" id="@mavogel/cdk-hugo-pipeline.HugoHostingProps.property.dockerImage"></a>

```typescript
public readonly dockerImage: string;
```

- *Type:* string
- *Default:* 'public.ecr.aws/docker/library/node:lts-alpine'

The docker image to use to build the hugo page.

Note: you need to use the 'apk' package manager

---

##### `http403ResponsePagePath`<sup>Optional</sup> <a name="http403ResponsePagePath" id="@mavogel/cdk-hugo-pipeline.HugoHostingProps.property.http403ResponsePagePath"></a>

```typescript
public readonly http403ResponsePagePath: string;
```

- *Type:* string
- *Default:* /en/404.html

The path to the 403 error page.

---

##### `http404ResponsePagePath`<sup>Optional</sup> <a name="http404ResponsePagePath" id="@mavogel/cdk-hugo-pipeline.HugoHostingProps.property.http404ResponsePagePath"></a>

```typescript
public readonly http404ResponsePagePath: string;
```

- *Type:* string
- *Default:* /en/404.html

The path to the 404 error page.

---

##### `hugoBuildCommand`<sup>Optional</sup> <a name="hugoBuildCommand" id="@mavogel/cdk-hugo-pipeline.HugoHostingProps.property.hugoBuildCommand"></a>

```typescript
public readonly hugoBuildCommand: string;
```

- *Type:* string
- *Default:* 'hugo --gc --minify --cleanDestinationDir'

The build command for the hugo site on which the '--environment' flag is appended.

---

##### `hugoProjectPath`<sup>Optional</sup> <a name="hugoProjectPath" id="@mavogel/cdk-hugo-pipeline.HugoHostingProps.property.hugoProjectPath"></a>

```typescript
public readonly hugoProjectPath: string;
```

- *Type:* string
- *Default:* 'path.join(process.cwd(), 'blog')'

The absolute path to the hugo project.

---

##### `s3deployAssetHash`<sup>Optional</sup> <a name="s3deployAssetHash" id="@mavogel/cdk-hugo-pipeline.HugoHostingProps.property.s3deployAssetHash"></a>

```typescript
public readonly s3deployAssetHash: string;
```

- *Type:* string
- *Default:* `${Number(Math.random())}-${props.buildStage}`

The hash to use to build or rebuild the hugo page.

We use it to rebuild the site every time as cdk caching is too intelligent
and it did not deploy updates.

For testing purposes we pass a static hash to avoid updates of the snapshot tests.

---

##### `siteSubDomain`<sup>Optional</sup> <a name="siteSubDomain" id="@mavogel/cdk-hugo-pipeline.HugoHostingProps.property.siteSubDomain"></a>

```typescript
public readonly siteSubDomain: string;
```

- *Type:* string
- *Default:* dev

The subdomain to host the development site on, for example 'dev'.

---

##### `zone`<sup>Optional</sup> <a name="zone" id="@mavogel/cdk-hugo-pipeline.HugoHostingProps.property.zone"></a>

```typescript
public readonly zone: HostedZone;
```

- *Type:* aws-cdk-lib.aws_route53.HostedZone

Zone the Domain Name is created in.

---

### HugoHostingStackProps <a name="HugoHostingStackProps" id="@mavogel/cdk-hugo-pipeline.HugoHostingStackProps"></a>

#### Initializer <a name="Initializer" id="@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.Initializer"></a>

```typescript
import { HugoHostingStackProps } from '@mavogel/cdk-hugo-pipeline'

const hugoHostingStackProps: HugoHostingStackProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.analyticsReporting">analyticsReporting</a></code> | <code>boolean</code> | Include runtime versioning information in this Stack. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.crossRegionReferences">crossRegionReferences</a></code> | <code>boolean</code> | Enable this flag to allow native cross region stack references. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.description">description</a></code> | <code>string</code> | A description of the stack. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.env">env</a></code> | <code>aws-cdk-lib.Environment</code> | The AWS environment (account/region) where this stack will be deployed. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.permissionsBoundary">permissionsBoundary</a></code> | <code>aws-cdk-lib.PermissionsBoundary</code> | Options for applying a permissions boundary to all IAM Roles and Users created within this Stage. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.stackName">stackName</a></code> | <code>string</code> | Name to deploy the stack with. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.synthesizer">synthesizer</a></code> | <code>aws-cdk-lib.IStackSynthesizer</code> | Synthesis method to use while deploying this stack. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.tags">tags</a></code> | <code>{[ key: string ]: string}</code> | Stack tags that will be applied to all the taggable resources and the stack itself. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.terminationProtection">terminationProtection</a></code> | <code>boolean</code> | Whether to enable termination protection for this stack. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.buildStage">buildStage</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.domainName">domainName</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.basicAuthPassword">basicAuthPassword</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.basicAuthUsername">basicAuthUsername</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.cloudfrontCustomFunctionCode">cloudfrontCustomFunctionCode</a></code> | <code>aws-cdk-lib.aws_cloudfront.FunctionCode</code> | *No description.* |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.cloudfrontRedirectReplacements">cloudfrontRedirectReplacements</a></code> | <code>{[ key: string ]: string}</code> | *No description.* |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.dockerImage">dockerImage</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.http403ResponsePagePath">http403ResponsePagePath</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.http404ResponsePagePath">http404ResponsePagePath</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.hugoBuildCommand">hugoBuildCommand</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.hugoProjectPath">hugoProjectPath</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.s3deployAssetHash">s3deployAssetHash</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.siteSubDomain">siteSubDomain</a></code> | <code>string</code> | *No description.* |

---

##### `analyticsReporting`<sup>Optional</sup> <a name="analyticsReporting" id="@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.analyticsReporting"></a>

```typescript
public readonly analyticsReporting: boolean;
```

- *Type:* boolean
- *Default:* `analyticsReporting` setting of containing `App`, or value of 'aws:cdk:version-reporting' context key

Include runtime versioning information in this Stack.

---

##### `crossRegionReferences`<sup>Optional</sup> <a name="crossRegionReferences" id="@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.crossRegionReferences"></a>

```typescript
public readonly crossRegionReferences: boolean;
```

- *Type:* boolean
- *Default:* false

Enable this flag to allow native cross region stack references.

Enabling this will create a CloudFormation custom resource
in both the producing stack and consuming stack in order to perform the export/import

This feature is currently experimental

---

##### `description`<sup>Optional</sup> <a name="description" id="@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.description"></a>

```typescript
public readonly description: string;
```

- *Type:* string
- *Default:* No description.

A description of the stack.

---

##### `env`<sup>Optional</sup> <a name="env" id="@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.env"></a>

```typescript
public readonly env: Environment;
```

- *Type:* aws-cdk-lib.Environment
- *Default:* The environment of the containing `Stage` if available, otherwise create the stack will be environment-agnostic.

The AWS environment (account/region) where this stack will be deployed.

Set the `region`/`account` fields of `env` to either a concrete value to
select the indicated environment (recommended for production stacks), or to
the values of environment variables
`CDK_DEFAULT_REGION`/`CDK_DEFAULT_ACCOUNT` to let the target environment
depend on the AWS credentials/configuration that the CDK CLI is executed
under (recommended for development stacks).

If the `Stack` is instantiated inside a `Stage`, any undefined
`region`/`account` fields from `env` will default to the same field on the
encompassing `Stage`, if configured there.

If either `region` or `account` are not set nor inherited from `Stage`, the
Stack will be considered "*environment-agnostic*"". Environment-agnostic
stacks can be deployed to any environment but may not be able to take
advantage of all features of the CDK. For example, they will not be able to
use environmental context lookups such as `ec2.Vpc.fromLookup` and will not
automatically translate Service Principals to the right format based on the
environment's AWS partition, and other such enhancements.

---

*Example*

```typescript
// Use a concrete account and region to deploy this stack to:
// `.account` and `.region` will simply return these values.
new Stack(app, 'Stack1', {
  env: {
    account: '123456789012',
    region: 'us-east-1'
  },
});

// Use the CLI's current credentials to determine the target environment:
// `.account` and `.region` will reflect the account+region the CLI
// is configured to use (based on the user CLI credentials)
new Stack(app, 'Stack2', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  },
});

// Define multiple stacks stage associated with an environment
const myStage = new Stage(app, 'MyStage', {
  env: {
    account: '123456789012',
    region: 'us-east-1'
  }
});

// both of these stacks will use the stage's account/region:
// `.account` and `.region` will resolve to the concrete values as above
new MyStack(myStage, 'Stack1');
new YourStack(myStage, 'Stack2');

// Define an environment-agnostic stack:
// `.account` and `.region` will resolve to `{ "Ref": "AWS::AccountId" }` and `{ "Ref": "AWS::Region" }` respectively.
// which will only resolve to actual values by CloudFormation during deployment.
new MyStack(app, 'Stack1');
```


##### `permissionsBoundary`<sup>Optional</sup> <a name="permissionsBoundary" id="@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.permissionsBoundary"></a>

```typescript
public readonly permissionsBoundary: PermissionsBoundary;
```

- *Type:* aws-cdk-lib.PermissionsBoundary
- *Default:* no permissions boundary is applied

Options for applying a permissions boundary to all IAM Roles and Users created within this Stage.

---

##### `stackName`<sup>Optional</sup> <a name="stackName" id="@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.stackName"></a>

```typescript
public readonly stackName: string;
```

- *Type:* string
- *Default:* Derived from construct path.

Name to deploy the stack with.

---

##### `synthesizer`<sup>Optional</sup> <a name="synthesizer" id="@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.synthesizer"></a>

```typescript
public readonly synthesizer: IStackSynthesizer;
```

- *Type:* aws-cdk-lib.IStackSynthesizer
- *Default:* The synthesizer specified on `App`, or `DefaultStackSynthesizer` otherwise.

Synthesis method to use while deploying this stack.

The Stack Synthesizer controls aspects of synthesis and deployment,
like how assets are referenced and what IAM roles to use. For more
information, see the README of the main CDK package.

If not specified, the `defaultStackSynthesizer` from `App` will be used.
If that is not specified, `DefaultStackSynthesizer` is used if
`@aws-cdk/core:newStyleStackSynthesis` is set to `true` or the CDK major
version is v2. In CDK v1 `LegacyStackSynthesizer` is the default if no
other synthesizer is specified.

---

##### `tags`<sup>Optional</sup> <a name="tags" id="@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.tags"></a>

```typescript
public readonly tags: {[ key: string ]: string};
```

- *Type:* {[ key: string ]: string}
- *Default:* {}

Stack tags that will be applied to all the taggable resources and the stack itself.

---

##### `terminationProtection`<sup>Optional</sup> <a name="terminationProtection" id="@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.terminationProtection"></a>

```typescript
public readonly terminationProtection: boolean;
```

- *Type:* boolean
- *Default:* false

Whether to enable termination protection for this stack.

---

##### `buildStage`<sup>Required</sup> <a name="buildStage" id="@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.buildStage"></a>

```typescript
public readonly buildStage: string;
```

- *Type:* string

---

##### `domainName`<sup>Required</sup> <a name="domainName" id="@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.domainName"></a>

```typescript
public readonly domainName: string;
```

- *Type:* string

---

##### `basicAuthPassword`<sup>Optional</sup> <a name="basicAuthPassword" id="@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.basicAuthPassword"></a>

```typescript
public readonly basicAuthPassword: string;
```

- *Type:* string

---

##### `basicAuthUsername`<sup>Optional</sup> <a name="basicAuthUsername" id="@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.basicAuthUsername"></a>

```typescript
public readonly basicAuthUsername: string;
```

- *Type:* string

---

##### `cloudfrontCustomFunctionCode`<sup>Optional</sup> <a name="cloudfrontCustomFunctionCode" id="@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.cloudfrontCustomFunctionCode"></a>

```typescript
public readonly cloudfrontCustomFunctionCode: FunctionCode;
```

- *Type:* aws-cdk-lib.aws_cloudfront.FunctionCode

---

##### `cloudfrontRedirectReplacements`<sup>Optional</sup> <a name="cloudfrontRedirectReplacements" id="@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.cloudfrontRedirectReplacements"></a>

```typescript
public readonly cloudfrontRedirectReplacements: {[ key: string ]: string};
```

- *Type:* {[ key: string ]: string}

---

##### `dockerImage`<sup>Optional</sup> <a name="dockerImage" id="@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.dockerImage"></a>

```typescript
public readonly dockerImage: string;
```

- *Type:* string

---

##### `http403ResponsePagePath`<sup>Optional</sup> <a name="http403ResponsePagePath" id="@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.http403ResponsePagePath"></a>

```typescript
public readonly http403ResponsePagePath: string;
```

- *Type:* string

---

##### `http404ResponsePagePath`<sup>Optional</sup> <a name="http404ResponsePagePath" id="@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.http404ResponsePagePath"></a>

```typescript
public readonly http404ResponsePagePath: string;
```

- *Type:* string

---

##### `hugoBuildCommand`<sup>Optional</sup> <a name="hugoBuildCommand" id="@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.hugoBuildCommand"></a>

```typescript
public readonly hugoBuildCommand: string;
```

- *Type:* string

---

##### `hugoProjectPath`<sup>Optional</sup> <a name="hugoProjectPath" id="@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.hugoProjectPath"></a>

```typescript
public readonly hugoProjectPath: string;
```

- *Type:* string

---

##### `s3deployAssetHash`<sup>Optional</sup> <a name="s3deployAssetHash" id="@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.s3deployAssetHash"></a>

```typescript
public readonly s3deployAssetHash: string;
```

- *Type:* string

---

##### `siteSubDomain`<sup>Optional</sup> <a name="siteSubDomain" id="@mavogel/cdk-hugo-pipeline.HugoHostingStackProps.property.siteSubDomain"></a>

```typescript
public readonly siteSubDomain: string;
```

- *Type:* string

---

### HugoPageStageProps <a name="HugoPageStageProps" id="@mavogel/cdk-hugo-pipeline.HugoPageStageProps"></a>

#### Initializer <a name="Initializer" id="@mavogel/cdk-hugo-pipeline.HugoPageStageProps.Initializer"></a>

```typescript
import { HugoPageStageProps } from '@mavogel/cdk-hugo-pipeline'

const hugoPageStageProps: HugoPageStageProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPageStageProps.property.env">env</a></code> | <code>aws-cdk-lib.Environment</code> | Default AWS environment (account/region) for `Stack`s in this `Stage`. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPageStageProps.property.outdir">outdir</a></code> | <code>string</code> | The output directory into which to emit synthesized artifacts. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPageStageProps.property.permissionsBoundary">permissionsBoundary</a></code> | <code>aws-cdk-lib.PermissionsBoundary</code> | Options for applying a permissions boundary to all IAM Roles and Users created within this Stage. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPageStageProps.property.policyValidationBeta1">policyValidationBeta1</a></code> | <code>aws-cdk-lib.IPolicyValidationPluginBeta1[]</code> | Validation plugins to run during synthesis. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPageStageProps.property.stageName">stageName</a></code> | <code>string</code> | Name of this stage. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPageStageProps.property.buildStage">buildStage</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPageStageProps.property.domainName">domainName</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPageStageProps.property.basicAuthPassword">basicAuthPassword</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPageStageProps.property.basicAuthUsername">basicAuthUsername</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPageStageProps.property.cloudfrontCustomFunctionCode">cloudfrontCustomFunctionCode</a></code> | <code>aws-cdk-lib.aws_cloudfront.FunctionCode</code> | *No description.* |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPageStageProps.property.cloudfrontRedirectReplacements">cloudfrontRedirectReplacements</a></code> | <code>{[ key: string ]: string}</code> | *No description.* |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPageStageProps.property.dockerImage">dockerImage</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPageStageProps.property.http403ResponsePagePath">http403ResponsePagePath</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPageStageProps.property.http404ResponsePagePath">http404ResponsePagePath</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPageStageProps.property.hugoBuildCommand">hugoBuildCommand</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPageStageProps.property.hugoProjectPath">hugoProjectPath</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPageStageProps.property.s3deployAssetHash">s3deployAssetHash</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPageStageProps.property.siteSubDomain">siteSubDomain</a></code> | <code>string</code> | *No description.* |

---

##### `env`<sup>Optional</sup> <a name="env" id="@mavogel/cdk-hugo-pipeline.HugoPageStageProps.property.env"></a>

```typescript
public readonly env: Environment;
```

- *Type:* aws-cdk-lib.Environment
- *Default:* The environments should be configured on the `Stack`s.

Default AWS environment (account/region) for `Stack`s in this `Stage`.

Stacks defined inside this `Stage` with either `region` or `account` missing
from its env will use the corresponding field given here.

If either `region` or `account`is is not configured for `Stack` (either on
the `Stack` itself or on the containing `Stage`), the Stack will be
*environment-agnostic*.

Environment-agnostic stacks can be deployed to any environment, may not be
able to take advantage of all features of the CDK. For example, they will
not be able to use environmental context lookups, will not automatically
translate Service Principals to the right format based on the environment's
AWS partition, and other such enhancements.

---

*Example*

```typescript
// Use a concrete account and region to deploy this Stage to
new Stage(app, 'Stage1', {
  env: { account: '123456789012', region: 'us-east-1' },
});

// Use the CLI's current credentials to determine the target environment
new Stage(app, 'Stage2', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});
```


##### `outdir`<sup>Optional</sup> <a name="outdir" id="@mavogel/cdk-hugo-pipeline.HugoPageStageProps.property.outdir"></a>

```typescript
public readonly outdir: string;
```

- *Type:* string
- *Default:* for nested stages, outdir will be determined as a relative directory to the outdir of the app. For apps, if outdir is not specified, a temporary directory will be created.

The output directory into which to emit synthesized artifacts.

Can only be specified if this stage is the root stage (the app). If this is
specified and this stage is nested within another stage, an error will be
thrown.

---

##### `permissionsBoundary`<sup>Optional</sup> <a name="permissionsBoundary" id="@mavogel/cdk-hugo-pipeline.HugoPageStageProps.property.permissionsBoundary"></a>

```typescript
public readonly permissionsBoundary: PermissionsBoundary;
```

- *Type:* aws-cdk-lib.PermissionsBoundary
- *Default:* no permissions boundary is applied

Options for applying a permissions boundary to all IAM Roles and Users created within this Stage.

---

##### `policyValidationBeta1`<sup>Optional</sup> <a name="policyValidationBeta1" id="@mavogel/cdk-hugo-pipeline.HugoPageStageProps.property.policyValidationBeta1"></a>

```typescript
public readonly policyValidationBeta1: IPolicyValidationPluginBeta1[];
```

- *Type:* aws-cdk-lib.IPolicyValidationPluginBeta1[]
- *Default:* no validation plugins are used

Validation plugins to run during synthesis.

If any plugin reports any violation,
synthesis will be interrupted and the report displayed to the user.

---

##### `stageName`<sup>Optional</sup> <a name="stageName" id="@mavogel/cdk-hugo-pipeline.HugoPageStageProps.property.stageName"></a>

```typescript
public readonly stageName: string;
```

- *Type:* string
- *Default:* Derived from the id.

Name of this stage.

---

##### `buildStage`<sup>Required</sup> <a name="buildStage" id="@mavogel/cdk-hugo-pipeline.HugoPageStageProps.property.buildStage"></a>

```typescript
public readonly buildStage: string;
```

- *Type:* string

---

##### `domainName`<sup>Required</sup> <a name="domainName" id="@mavogel/cdk-hugo-pipeline.HugoPageStageProps.property.domainName"></a>

```typescript
public readonly domainName: string;
```

- *Type:* string

---

##### `basicAuthPassword`<sup>Optional</sup> <a name="basicAuthPassword" id="@mavogel/cdk-hugo-pipeline.HugoPageStageProps.property.basicAuthPassword"></a>

```typescript
public readonly basicAuthPassword: string;
```

- *Type:* string

---

##### `basicAuthUsername`<sup>Optional</sup> <a name="basicAuthUsername" id="@mavogel/cdk-hugo-pipeline.HugoPageStageProps.property.basicAuthUsername"></a>

```typescript
public readonly basicAuthUsername: string;
```

- *Type:* string

---

##### `cloudfrontCustomFunctionCode`<sup>Optional</sup> <a name="cloudfrontCustomFunctionCode" id="@mavogel/cdk-hugo-pipeline.HugoPageStageProps.property.cloudfrontCustomFunctionCode"></a>

```typescript
public readonly cloudfrontCustomFunctionCode: FunctionCode;
```

- *Type:* aws-cdk-lib.aws_cloudfront.FunctionCode

---

##### `cloudfrontRedirectReplacements`<sup>Optional</sup> <a name="cloudfrontRedirectReplacements" id="@mavogel/cdk-hugo-pipeline.HugoPageStageProps.property.cloudfrontRedirectReplacements"></a>

```typescript
public readonly cloudfrontRedirectReplacements: {[ key: string ]: string};
```

- *Type:* {[ key: string ]: string}

---

##### `dockerImage`<sup>Optional</sup> <a name="dockerImage" id="@mavogel/cdk-hugo-pipeline.HugoPageStageProps.property.dockerImage"></a>

```typescript
public readonly dockerImage: string;
```

- *Type:* string

---

##### `http403ResponsePagePath`<sup>Optional</sup> <a name="http403ResponsePagePath" id="@mavogel/cdk-hugo-pipeline.HugoPageStageProps.property.http403ResponsePagePath"></a>

```typescript
public readonly http403ResponsePagePath: string;
```

- *Type:* string

---

##### `http404ResponsePagePath`<sup>Optional</sup> <a name="http404ResponsePagePath" id="@mavogel/cdk-hugo-pipeline.HugoPageStageProps.property.http404ResponsePagePath"></a>

```typescript
public readonly http404ResponsePagePath: string;
```

- *Type:* string

---

##### `hugoBuildCommand`<sup>Optional</sup> <a name="hugoBuildCommand" id="@mavogel/cdk-hugo-pipeline.HugoPageStageProps.property.hugoBuildCommand"></a>

```typescript
public readonly hugoBuildCommand: string;
```

- *Type:* string

---

##### `hugoProjectPath`<sup>Optional</sup> <a name="hugoProjectPath" id="@mavogel/cdk-hugo-pipeline.HugoPageStageProps.property.hugoProjectPath"></a>

```typescript
public readonly hugoProjectPath: string;
```

- *Type:* string

---

##### `s3deployAssetHash`<sup>Optional</sup> <a name="s3deployAssetHash" id="@mavogel/cdk-hugo-pipeline.HugoPageStageProps.property.s3deployAssetHash"></a>

```typescript
public readonly s3deployAssetHash: string;
```

- *Type:* string

---

##### `siteSubDomain`<sup>Optional</sup> <a name="siteSubDomain" id="@mavogel/cdk-hugo-pipeline.HugoPageStageProps.property.siteSubDomain"></a>

```typescript
public readonly siteSubDomain: string;
```

- *Type:* string

---

### HugoPipelineProps <a name="HugoPipelineProps" id="@mavogel/cdk-hugo-pipeline.HugoPipelineProps"></a>

#### Initializer <a name="Initializer" id="@mavogel/cdk-hugo-pipeline.HugoPipelineProps.Initializer"></a>

```typescript
import { HugoPipelineProps } from '@mavogel/cdk-hugo-pipeline'

const hugoPipelineProps: HugoPipelineProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPipelineProps.property.domainName">domainName</a></code> | <code>string</code> | Name of the domain to host the site on. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPipelineProps.property.basicAuthPassword">basicAuthPassword</a></code> | <code>string</code> | The password for basic auth on the development site. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPipelineProps.property.basicAuthUsername">basicAuthUsername</a></code> | <code>string</code> | The username for basic auth on the development site. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPipelineProps.property.cloudfrontCustomFunctionCodeDevelopment">cloudfrontCustomFunctionCodeDevelopment</a></code> | <code>aws-cdk-lib.aws_cloudfront.FunctionCode</code> | The cloudfront custom function code for the development stage. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPipelineProps.property.cloudfrontCustomFunctionCodeProduction">cloudfrontCustomFunctionCodeProduction</a></code> | <code>aws-cdk-lib.aws_cloudfront.FunctionCode</code> | The cloudfront custom function code for the production stage. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPipelineProps.property.cloudfrontRedirectReplacements">cloudfrontRedirectReplacements</a></code> | <code>{[ key: string ]: string}</code> | The cloudfront redirect replacements. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPipelineProps.property.dockerImage">dockerImage</a></code> | <code>string</code> | The docker image to use to build the hugo page. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPipelineProps.property.http403ResponsePagePath">http403ResponsePagePath</a></code> | <code>string</code> | The path to the 403 error page. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPipelineProps.property.http404ResponsePagePath">http404ResponsePagePath</a></code> | <code>string</code> | The path to the 404 error page. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPipelineProps.property.hugoBuildCommand">hugoBuildCommand</a></code> | <code>string</code> | The build command for the hugo site on which the '--environment' flag is appended. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPipelineProps.property.hugoProjectPath">hugoProjectPath</a></code> | <code>string</code> | The path to the hugo project. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPipelineProps.property.name">name</a></code> | <code>string</code> | Name of the codecommit repository. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPipelineProps.property.s3deployAssetHash">s3deployAssetHash</a></code> | <code>string</code> | The hash to use to build or rebuild the hugo page. |
| <code><a href="#@mavogel/cdk-hugo-pipeline.HugoPipelineProps.property.siteSubDomain">siteSubDomain</a></code> | <code>string</code> | The subdomain to host the development site on, for example 'dev'. |

---

##### `domainName`<sup>Required</sup> <a name="domainName" id="@mavogel/cdk-hugo-pipeline.HugoPipelineProps.property.domainName"></a>

```typescript
public readonly domainName: string;
```

- *Type:* string

Name of the domain to host the site on.

---

##### `basicAuthPassword`<sup>Optional</sup> <a name="basicAuthPassword" id="@mavogel/cdk-hugo-pipeline.HugoPipelineProps.property.basicAuthPassword"></a>

```typescript
public readonly basicAuthPassword: string;
```

- *Type:* string
- *Default:* doe

The password for basic auth on the development site.

---

##### `basicAuthUsername`<sup>Optional</sup> <a name="basicAuthUsername" id="@mavogel/cdk-hugo-pipeline.HugoPipelineProps.property.basicAuthUsername"></a>

```typescript
public readonly basicAuthUsername: string;
```

- *Type:* string
- *Default:* john

The username for basic auth on the development site.

---

##### `cloudfrontCustomFunctionCodeDevelopment`<sup>Optional</sup> <a name="cloudfrontCustomFunctionCodeDevelopment" id="@mavogel/cdk-hugo-pipeline.HugoPipelineProps.property.cloudfrontCustomFunctionCodeDevelopment"></a>

```typescript
public readonly cloudfrontCustomFunctionCodeDevelopment: FunctionCode;
```

- *Type:* aws-cdk-lib.aws_cloudfront.FunctionCode
- *Default:* undefined

The cloudfront custom function code for the development stage.

---

##### `cloudfrontCustomFunctionCodeProduction`<sup>Optional</sup> <a name="cloudfrontCustomFunctionCodeProduction" id="@mavogel/cdk-hugo-pipeline.HugoPipelineProps.property.cloudfrontCustomFunctionCodeProduction"></a>

```typescript
public readonly cloudfrontCustomFunctionCodeProduction: FunctionCode;
```

- *Type:* aws-cdk-lib.aws_cloudfront.FunctionCode
- *Default:* undefined

The cloudfront custom function code for the production stage.

---

##### `cloudfrontRedirectReplacements`<sup>Optional</sup> <a name="cloudfrontRedirectReplacements" id="@mavogel/cdk-hugo-pipeline.HugoPipelineProps.property.cloudfrontRedirectReplacements"></a>

```typescript
public readonly cloudfrontRedirectReplacements: {[ key: string ]: string};
```

- *Type:* {[ key: string ]: string}
- *Default:* {}

The cloudfront redirect replacements.

Those are string replacements for the request.uri.
Note: the replacements are regular expressions.
Note: if cloudfrontCustomFunctionCode(Development|Production) is set, this property is ignored.

---

##### `dockerImage`<sup>Optional</sup> <a name="dockerImage" id="@mavogel/cdk-hugo-pipeline.HugoPipelineProps.property.dockerImage"></a>

```typescript
public readonly dockerImage: string;
```

- *Type:* string
- *Default:* 'public.ecr.aws/docker/library/node:lts-alpine'

The docker image to use to build the hugo page.

Note: you need to use the 'apk' package manager

---

##### `http403ResponsePagePath`<sup>Optional</sup> <a name="http403ResponsePagePath" id="@mavogel/cdk-hugo-pipeline.HugoPipelineProps.property.http403ResponsePagePath"></a>

```typescript
public readonly http403ResponsePagePath: string;
```

- *Type:* string
- *Default:* /en/404.html

The path to the 403 error page.

---

##### `http404ResponsePagePath`<sup>Optional</sup> <a name="http404ResponsePagePath" id="@mavogel/cdk-hugo-pipeline.HugoPipelineProps.property.http404ResponsePagePath"></a>

```typescript
public readonly http404ResponsePagePath: string;
```

- *Type:* string
- *Default:* /en/404.html

The path to the 404 error page.

---

##### `hugoBuildCommand`<sup>Optional</sup> <a name="hugoBuildCommand" id="@mavogel/cdk-hugo-pipeline.HugoPipelineProps.property.hugoBuildCommand"></a>

```typescript
public readonly hugoBuildCommand: string;
```

- *Type:* string
- *Default:* 'hugo --gc --minify --cleanDestinationDir'

The build command for the hugo site on which the '--environment' flag is appended.

---

##### `hugoProjectPath`<sup>Optional</sup> <a name="hugoProjectPath" id="@mavogel/cdk-hugo-pipeline.HugoPipelineProps.property.hugoProjectPath"></a>

```typescript
public readonly hugoProjectPath: string;
```

- *Type:* string
- *Default:* '../../../../blog'

The path to the hugo project.

---

##### `name`<sup>Optional</sup> <a name="name" id="@mavogel/cdk-hugo-pipeline.HugoPipelineProps.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string
- *Default:* hugo blog

Name of the codecommit repository.

---

##### `s3deployAssetHash`<sup>Optional</sup> <a name="s3deployAssetHash" id="@mavogel/cdk-hugo-pipeline.HugoPipelineProps.property.s3deployAssetHash"></a>

```typescript
public readonly s3deployAssetHash: string;
```

- *Type:* string
- *Default:* `${Number(Math.random())}-${props.buildStage}`

The hash to use to build or rebuild the hugo page.

We use it to rebuild the site every time as cdk caching is too intelligent
and it did not deploy updates.

For testing purposes we pass a static hash to avoid updates of the snapshot tests.

---

##### `siteSubDomain`<sup>Optional</sup> <a name="siteSubDomain" id="@mavogel/cdk-hugo-pipeline.HugoPipelineProps.property.siteSubDomain"></a>

```typescript
public readonly siteSubDomain: string;
```

- *Type:* string
- *Default:* dev

The subdomain to host the development site on, for example 'dev'.

---



