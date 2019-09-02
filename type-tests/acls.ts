import { Acl, IAcl } from 'shipit-bot/types';
import OwnerAcl from '../src/models/acl/owner';
import ReleaseOwnerAcl from '../src/models/acl/release-owner';
/**
 * Type information tests for ACLs
 */

// tslint:disable-next-line: prefer-const
let acl!: Acl;

/**
 * Without narrowing, an ACL shouldn't be usable as an "owner acl" or "release owner acl"
 */
acl.owners; // $ExpectError
acl.release_owners; // $ExpectError

// it should have

acl.appliesToFile('foo.txt'); // $ExpectType boolean

if (acl.kind === 'owner') {
  // if this is an "owner acl", we should find "owners"
  acl.owners; // $ExpectType string[]
  acl.release_owners; // $ExpectError
} else {
  // otherwise it must be a "release owner acl", we should find "release_owners"
  acl.release_owners; // $ExpectType string[]
  acl.owners; // $ExpectError
}

// tslint:disable-next-line: prefer-const
let aclInterface!: IAcl;

/**
 * Without narrowing, it's not usable as an "owner acl" or "release owner acl"
 */
aclInterface.owners; // $ExpectError
aclInterface.release_owners; // $ExpectError
aclInterface.appliesToFile; // $ExpectError

aclInterface.paths; // $ExpectType string[]
