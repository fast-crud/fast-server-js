import { AbstractAliyunPlugin } from '../abstract-aliyun';
import * as Core from '@alicloud/pop-core';
import * as dayjs from 'dayjs';

const define = {
  name: 'deployCertToAliyunCDN',
  label: '部署到阿里云CDN',
  input: {
    domainName: {
      label: 'cdn加速域名',
      component: {
        placeholder: 'cdn加速域名',
      },
      required: true,
    },
    certName: {
      label: '证书名称',
      component: {
        placeholder: '上传后将以此名称作为前缀',
      },
    },
    from: {
      default: 'upload',
      label: '证书来源',
      required: true,
      component: {
        required: true,
        placeholder: '证书来源',
        name: 'a-select',
        options: [
          { value: 'upload', label: '直接上传' },
          {
            value: 'cas',
            label: '从证书库',
            title: '需要uploadCertToAliyun作为前置任务',
          },
        ],
      },
      desc: '如果选择‘从证书库’类型，则需要以《上传证书到阿里云》作为前置任务',
    },
    // serverCertificateStatus: {
    //   label: '启用https',
    //   options: [
    //     { value: 'on', label: '开启HTTPS，并更新证书' },
    //     { value: 'auto', label: '若HTTPS开启则更新，未开启不更新' }
    //   ],
    //   required:true
    // },
    accessId: {
      label: 'Access提供者',
      type: [Number],
      desc: 'access授权',
      component: {
        name: 'access-selector',
        filter: 'aliyun',
      },
      required: true,
    },
  },
  output: {},
};

export class DeployCertToAliyunCDN extends AbstractAliyunPlugin {
  static define() {
    return define;
  }

  async execute({ cert, props, context }) {
    const access = await this.getAccess(props.accessId);
    const client = this.getClient(access);
    const params = this.buildParams(props, context, cert);
    await this.doRequest(client, params);
  }

  getClient(aliyunProvider) {
    return new Core({
      accessKeyId: aliyunProvider.accessKeyId,
      accessKeySecret: aliyunProvider.accessKeySecret,
      endpoint: 'https://cdn.aliyuncs.com',
      apiVersion: '2018-05-10',
    });
  }

  buildParams(args, context, cert) {
    const { certName, from, domainName } = args;
    const CertName = certName + '-' + dayjs().format('YYYYMMDDHHmmss');

    const params = {
      RegionId: 'cn-hangzhou',
      DomainName: domainName,
      ServerCertificateStatus: 'on',
      CertName: CertName,
      CertType: from,
      ServerCertificate: cert.crt,
      PrivateKey: cert.key,
    };
    return params;
  }

  async doRequest(client, params) {
    const requestOption = {
      method: 'POST',
    };
    const ret = await client.request(
      'SetDomainServerCertificate',
      params,
      requestOption
    );
    this.checkRet(ret);
    this.logger.info('设置cdn证书成功:', ret.RequestId);
  }
}
