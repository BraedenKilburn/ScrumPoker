import { expect, test, describe, mock } from 'bun:test'
import { MessageHandler } from '../messageHandler'

describe('MessageHandler', () => {
  test('parseMessage should parse valid JSON', () => {
    const message = JSON.stringify({ type: 'test', data: { foo: 'bar' } })
    const result = MessageHandler.parseMessage(message)
    expect(result).toEqual({ type: 'test', data: { foo: 'bar' } })
  })

  test('parseMessage should throw error for invalid JSON', () => {
    const message = 'invalid json'
    expect(() => MessageHandler.parseMessage(message)).toThrow(
      'Invalid message format',
    )
  })

  test('createMessage should create valid message with data', () => {
    const result = MessageHandler.createMessage('test', { foo: 'bar' })
    expect(JSON.parse(result)).toEqual({ type: 'test', data: { foo: 'bar' } })
  })

  test('createMessage should handle Map data', () => {
    const map = new Map([
      ['user1', '5'],
      ['user2', '3'],
    ])
    const result = MessageHandler.createMessage('test', map)
    expect(JSON.parse(result)).toEqual({
      type: 'test',
      data: { user1: '5', user2: '3' },
    })
  })

  test('createUserVotedMessage should create valid vote message', () => {
    const getUsersVote = mock(() => '5')
    const roomManager: any = { getUsersVote }
    const result = MessageHandler.createUserVotedMessage(
      'room1',
      'user1',
      roomManager,
    )
    expect(getUsersVote).toHaveBeenCalledWith('room1', 'user1')
    expect(JSON.parse(result)).toEqual({
      type: 'userVoted',
      data: { username: 'user1', vote: '5' },
    })
  })

  test('createVoteStatusMessage should create valid status message', () => {
    const getRoomVisibility = mock(() => true)
    const getRoomVotes = mock(() => new Map([
      ['user1', '5'],
      ['user2', '3'],
    ]))
    const roomManager: any = { getRoomVisibility, getRoomVotes }
    const result = MessageHandler.createVoteStatusMessage(
      'room1',
      roomManager,
    )
    expect(getRoomVisibility).toHaveBeenCalledWith('room1')
    expect(getRoomVotes).toHaveBeenCalledWith('room1')
    expect(JSON.parse(result)).toEqual({
      type: 'voteStatus',
      data: {
        revealed: true,
        votes: { user1: '5', user2: '3' },
      },
    })
  })
})
