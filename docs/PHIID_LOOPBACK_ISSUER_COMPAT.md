# PhiID Local OIDC Development-Issuer Compatibility

**Status:** development-only cross-project protocol compatibility. This is a narrow addition to the PhiID-compatible approval verifier v0; it does not implement real OIDC token validation or change the existing signed-execution Keyhole.

## Reason

PhiID's R4/R5/R6 identity lab uses a real, validated Keycloak OIDC session whose issuer is **exactly**:

```text
http://127.0.0.1:8080/realms/phiid-dev
```

The NBGPocketMesh approval v0 contract originally accepted only HTTPS-shaped issuer strings, so a real PhiID development-session approval could not pass its shape parser even when the independent Ed25519 approval signature was valid.

## Narrow rule

The principal shape validator now accepts:

- The existing strict HTTPS issuer format
- **Exactly** the pinned PhiID local Keycloak issuer above, with no aliases, query strings, fragments, different ports, different realms or trailing slash

This is an *input-format exception* solely for the known dev realm. It is **not** a relaxation of signature, permission, or routing policy:

1. The approval must still be Ed25519-signed by an operator-pinned **independent** approval key.
2. The existing signed execution permit must also be valid, with a different Ed25519 signer.
3. The signed approval binds the exact signed permit, purpose, scope, audience, approval ID, expiry and policy epoch.
4. The operator's protected approval policy must separately allow **the exact issuer and subject pair** from the verified local session; merely matching the issuer is insufficient.
5. The executor still uses the same one-use replay ledger, approved local module registry, E0 route binding, typed Keyhole and memory policy.
6. The development issuer does not authenticate itself. The separate PhiID R6 localhost BFF is responsible for the original real OIDC verification before any approval is signed. This repository verifies only the resulting independently signed attestation.

## Tests

```sh
npm test
npm run demo:phiid
```

The tests cover the correctly pinned development issuer and all rejection cases for localhost aliases, different ports, different realms, trailing slash, query injection, and an otherwise correctly signed but disallowed subject.

## Limitations

**Not production authorization.** PhiID R6 and this acceptance rule are localhost-only experiments. No real cross-repo end-to-end Keycloak-to-PocketMesh execution test is implied by separately passing suites. The operator must configure matching public approver keys and exact allowed subject IDs on the PocketMesh side; never auto-trust all users from a matching issuer.

A public deployment should use a newly configured **HTTPS** issuer and vetted OIDC client/token validation at the identity boundary. It should avoid using the loopback development exception or sharing development keys with production signers.
