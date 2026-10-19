import { isValidContractId } from '@/lib/stellar'

describe('isValidContractId', () => {
  it('accepts valid contract IDs', () => {
    expect(isValidContractId('CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA7')).toBe(true)
    expect(isValidContractId('CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE')).toBe(true)
  })

  it('rejects a one-character typo (bad checksum)', () => {
    expect(isValidContractId('CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXF')).toBe(false)
  })

  it('rejects a G-address', () => {
    expect(isValidContractId('GA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE')).toBe(false)
  })

  it('rejects wrong prefix', () => {
    expect(isValidContractId('GBCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ2345')).toBe(
      false
    )
  })

  it('rejects wrong length', () => {
    expect(isValidContractId('CBCDEF')).toBe(false)
    expect(isValidContractId('CBCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ2345EXTRA')).toBe(
      false
    )
  })

  it('rejects lowercase input', () => {
    expect(isValidContractId('cbcdefghijklmnopqrstuvwxyz234567abcdefghijklmnopqrstuvwxyz2345')).toBe(
      false
    )
  })

  it('rejects invalid characters', () => {
    expect(isValidContractId('CBCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ234!')).toBe(
      false
    )
  })
})