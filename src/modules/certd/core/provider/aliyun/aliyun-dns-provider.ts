import { AbstractDnsProvider } from '../../api/abstract-dns-provider';
import * as Core from '@alicloud/pop-core';
import * as _ from 'lodash';
import { AliyunAccess } from './aliyun-access-define';
export class AliyunDnsProvider extends AbstractDnsProvider {
  static define() {
    return {
      name: 'aliyun',
      label: '阿里云',
      desc: '',
      input: {
        accessId: {
          label: '授权',
          type: [String, Object],
          desc: '需要aliyun类型的授权',
          component: {
            name: 'access-selector',
            filter: 'aliyun',
          },
          required: true,
        },
      },
      output: {},
    };
  }

  accessId;
  client;
  constructor(args) {
    super(args);
    const { props } = args;
    this.accessId = props.accessId;
    this.init();
  }

  async init() {
    const access: AliyunAccess = await this.getAccess(this.accessId);
    this.client = new Core({
      accessKeyId: access.accessKeyId,
      accessKeySecret: access.accessKeySecret,
      endpoint: 'https://alidns.aliyuncs.com',
      apiVersion: '2015-01-09',
    });
  }
  async getDomainList() {
    const params = {
      RegionId: 'cn-hangzhou',
    };

    const requestOption = {
      method: 'POST',
    };

    const ret = await this.client.request(
      'DescribeDomains',
      params,
      requestOption
    );
    return ret.Domains.Domain;
  }

  async matchDomain(dnsRecord) {
    const list = await this.getDomainList();
    let domain = null;
    for (const item of list) {
      if (_.endsWith(dnsRecord, item.DomainName)) {
        domain = item.DomainName;
        break;
      }
    }
    if (!domain) {
      throw new Error('can not find Domain ,' + dnsRecord);
    }
    return domain;
  }

  async getRecords(domain, rr, value) {
    const params = {
      RegionId: 'cn-hangzhou',
      DomainName: domain,
      RRKeyWord: rr,
      ValueKeyWord: undefined,
    };
    if (value) {
      params.ValueKeyWord = value;
    }

    const requestOption = {
      method: 'POST',
    };

    const ret = await this.client.request(
      'DescribeDomainRecords',
      params,
      requestOption
    );
    return ret.DomainRecords.Record;
  }

  async createRecord({ fullRecord, type, value }) {
    this.logger.info('添加域名解析：', fullRecord, value);
    const domain = await this.matchDomain(fullRecord);
    const rr = fullRecord.replace('.' + domain, '');

    const params = {
      RegionId: 'cn-hangzhou',
      DomainName: domain,
      RR: rr,
      Type: type,
      Value: value,
      // Line: 'oversea' // 海外
    };

    const requestOption = {
      method: 'POST',
    };

    try {
      const ret = await this.client.request(
        'AddDomainRecord',
        params,
        requestOption
      );
      this.logger.info('添加域名解析成功:', value, value, ret.RecordId);
      return ret.RecordId;
    } catch (e) {
      if (e.code === 'DomainRecordDuplicate') {
        return;
      }
      this.logger.info('添加域名解析出错', e);
      throw e;
    }
  }

  async removeRecord({ fullRecord, type, value, record }) {
    const params = {
      RegionId: 'cn-hangzhou',
      RecordId: record,
    };

    const requestOption = {
      method: 'POST',
    };

    const ret = await this.client.request(
      'DeleteDomainRecord',
      params,
      requestOption
    );
    this.logger.info('删除域名解析成功:', fullRecord, value, ret.RecordId);
    return ret.RecordId;
  }
}
