# Nota Técnica — Amazon SP-API

## OAuth / LWA

A Amazon Selling Partner API utiliza Login with Amazon (LWA), baseado em OAuth 2.0. Para operações autorizadas por um seller, a aplicação troca `refresh_token`, `client_id` e `client_secret` por um `access_token`, que é utilizado no header `x-amz-access-token`.

O `access_token` expira em aproximadamente 1 hora (`expires_in = 3600`). Portanto, o teste exige que o candidato renove o access token quando necessário.

A documentação atual de onboarding informa que refresh tokens não expiram. Uma página oficial mais antiga ainda menciona reautorização anual; esse ciclo não faz parte do desafio.

## Escopo de listings

O teste assume que o SKU já existe na Amazon. A solução atualiza apenas preço e estoque usando a operação de atualização parcial de listing (`patchListingsItem`). Criar novos anúncios ampliaria o escopo, pois exige `productType` e atributos do catálogo aplicáveis ao marketplace e ao tipo de produto.

## Segurança

No produto real, `client_secret` e `refresh_token` devem permanecer em armazenamento seguro e nunca aparecer em logs. O mock apenas os expõe para permitir execução local do exercício.
