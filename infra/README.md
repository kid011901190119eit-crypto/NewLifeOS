# infra/

クラウドの設定をコードで管理します(IaC: Infrastructure as Code)。ツールはOpenTofu(Terraform互換)を使います。

| ディレクトリ | 管理するもの |
|---|---|
| `opentofu/oracle/` | Oracle Cloudの仮想マシン、ネットワーク、Object Storage |
| `opentofu/cloudflare/` | DNS、Tunnel、Access、WAF、R2 |
| `opentofu/aws/` | 外部死活監視(Lambda、EventBridge Scheduler)、予算アラート |

## 注意

- 状態ファイル(`*.tfstate`)と変数ファイル(`*.tfvars`)には秘密情報が含まれるため、コミットしません。
- 管理画面から手で設定を変えると、コードと実際の状態がずれます。変更は必ずコード経由で行います。
