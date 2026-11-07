/**
 * R13 remote-deployment bind guard. Deliberately supports ONLY literal IPv4
 * private-network addresses, no wildcard DNS/public listener, and requires
 * an independent operator opt-in for anything beyond local loopback.
 * This is NOT a firewall or proof that the host is administratively separate.
 */
import {isIP} from 'node:net';

export function validateAnchorBind(host,port,{remoteApproved=false}={}){
  if(typeof host!=='string'||isIP(host)!==4)
    throw new TypeError('Authority bind host must be a literal IPv4 address');
  const octets=host.split('.');
  if(octets.some(x=>String(Number(x))!==x||Number(x)>255))
    throw new TypeError('Noncanonical IP address refused');
  if(!Number.isSafeInteger(port)||port<0||port>65535)
    throw new TypeError('Authority port invalid');
  const [a,b]=octets.map(Number);
  const loopback=a===127;
  const privateIp=(a===10||(a===172&&b>=16&&b<=31)||
    (a===192&&b===168));
  if(!loopback&&!privateIp)
    throw new TypeError('Authority must bind loopback or RFC1918 private IPv4');
  if(!loopback&&(!remoteApproved||port===0))
    throw new TypeError('Non-loopback authority requires explicit approval and fixed port');
  return Object.freeze({host,port,remote:!loopback});
}
