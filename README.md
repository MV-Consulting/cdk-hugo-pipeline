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
TBD

```sh
mkdir my-blog && cd my-blog
npx projen new awscdk-app-ts --github false --no-git
# add hugo template
git submodule add https://github.com/apvarun/blist-hugo-theme.git frontend/themes/blist
# add fix version
git submodule set-branch --branch v2.1.0 frontend/themes/blist
# copy the example site
cp -r frontend/themes/blist/exampleSite/*  frontend/
# fix the config urls
mkdir -p frontend/config/_default frontend/config/development frontend/config/production
mv frontend/config.toml frontend/config/_default/config.toml
sed -i '1d' frontend/config/_default/config.toml # TODO dynamic with grep
#
cat <<EOF > frontend/config/development
baseurl = "https://dev.mavogel.xyz"
publishDir = "public-development"
EOF
cat <<EOF > frontend/config/production
baseurl = "https://mavogel.xyz"
publishDir = "public-production"
EOF
# ignore output folders
cat <<EOF > frontend/.gitignore
public-*
resources/_gen
node_modules
.DS_Store
*.bak
.hugo_build.lock
EOF
# additionally copy package.jsons
cp frontend/themes/blist/package.json frontend/package.json
cp frontend/themes/blist/package-lock.json frontend/package-lock.json
# make file
cat <<EOF > Makefile
.DEFAULT_GOAL := run

clean:
	rm -rf frontend/public || true

build:
	cd frontend && npm i && hugo -D --gc

run:
	cd frontend && npm i && hugo server --watch --buildFuture --cleanDestinationDir
EOF
```

Next steps:
- build it locally via `npx cdk synth`
- deploy the repo and the pipeline once via `npx cdk deploy`
- add the created `codecommit` as remote and switch branch `git branch -m master main`
- push to the repo and wait until the pipeline is passed!

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
