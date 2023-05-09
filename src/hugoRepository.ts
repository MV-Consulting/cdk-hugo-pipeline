import { aws_codecommit as codecommit } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface HugoRepositoryProps {
  /**
   * Name of the repository
   *
   * @default - hugo blog
   */
  readonly name?: string;
}

export class HugoRepository extends Construct {

  constructor(scope: Construct, id: string, props: HugoRepositoryProps) {
    super(scope, id);

    new codecommit.Repository(this, 'hugo-blog', {
      repositoryName: props.name || 'hugo-blog',
      description: 'host the code for the hugo blog and its infrastructure',
    });
  }
}