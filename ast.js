import { RubyNode } from './lib/rubynode.js';

export const ast = new RubyNode('begin', [
    new RubyNode('class', [
        new RubyNode('const', [
            null,
            'A'
        ]),
        null,
        new RubyNode('begin', [
            new RubyNode('def', [
                'f',
                new RubyNode('args'),
                new RubyNode('send', [
                    null,
                    'f2'
                ])
            ]),
            new RubyNode('def', [
                'f2',
                new RubyNode('args'),
                new RubyNode('int', [1])
            ])
        ])
    ]),
    new RubyNode('send', [
        null,
        'puts',
        new RubyNode('send', [
            new RubyNode('send', [
                new RubyNode('const', [
                    null,
                    'A'
                ]),
                'new'
            ]),
            'f'
        ])
    ])
]);