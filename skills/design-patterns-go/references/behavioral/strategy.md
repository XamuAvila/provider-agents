# Strategy (Go)

**Categoria:** Behavioral  
**Fonte:** https://refactoring.guru/pt-br/design-patterns/strategy/go/example

## Intenção

O Strategy é um padrão de projeto comportamental que transforma um conjunto de comportamentos em objetos e os torna intercambiáveis dentro do objeto de contexto original.

O objeto original, chamado contexto, mantém uma referência a um objeto strategy e o delega a execução do comportamento. Para alterar a maneira como o contexto executa seu trabalho, outros objetos podem substituir o objeto strategy atualmente vinculado por outro.

## Contexto do Exemplo

Suponha que você esteja criando um cache na memória. Por estar na memória, seu tamanho é limitado. Sempre que atinge seu tamanho máximo, algumas entradas precisam ser despejadas para liberar espaço. Isso pode acontecer por meio de vários algoritmos. Alguns dos algoritmos populares são:

O problema é como desacoplar nossa classe de cache desses algoritmos para que possamos alterar o algoritmo em tempo de execução. Além disso, a classe de cache não deve ser alterada quando um novo algoritmo está sendo adicionado.

É aqui que o padrão Strategy entra em cena. Ele sugere a criação de uma família do algoritmo com cada algoritmo tendo sua própria classe. Cada uma dessas classes segue a mesma interface, e isso torna o algoritmo intercambiável dentro da família. Digamos que o nome comum da interface seja evictionAlgo .

## Implementação em Go

### `evictionalgo.go`

```go
package main

type EvictionAlgo interface {
	evict(c *Cache)
}
```

### `fifo.go` — Estratégia concreta

```go
package main

import "fmt"

type Fifo struct {
}

func (l *Fifo) evict(c *Cache) {
	fmt.Println("Evicting by fifo strtegy")
}
```

### `lru.go` — Estratégia concreta

```go
package main

import "fmt"

type Lru struct {
}

func (l *Lru) evict(c *Cache) {
	fmt.Println("Evicting by lru strtegy")
}
```

### `lfu.go` — Estratégia concreta

```go
package main

import "fmt"

type Lfu struct {
}

func (l *Lfu) evict(c *Cache) {
	fmt.Println("Evicting by lfu strtegy")
}
```

### `cache.go` — Context

```go
package main

type Cache struct {
	storage      map[string]string
	evictionAlgo EvictionAlgo
	capacity     int
	maxCapacity  int
}

func initCache(e EvictionAlgo) *Cache {
	storage := make(map[string]string)
	return &Cache{
		storage:      storage,
		evictionAlgo: e,
		capacity:     0,
		maxCapacity:  2,
	}
}

func (c *Cache) setEvictionAlgo(e EvictionAlgo) {
	c.evictionAlgo = e
}

func (c *Cache) add(key, value string) {
	if c.capacity == c.maxCapacity {
		c.evict()
	}
	c.capacity++
	c.storage[key] = value
}

func (c *Cache) get(key string) {
	delete(c.storage, key)
}

func (c *Cache) evict() {
	c.evictionAlgo.evict(c)
	c.capacity--
}
```

### `main.go` — Código cliente

```go
package main

func main() {
	lfu := &Lfu{}
	cache := initCache(lfu)

	cache.add("a", "1")
	cache.add("b", "2")

	cache.add("c", "3")

	lru := &Lru{}
	cache.setEvictionAlgo(lru)

	cache.add("d", "4")

	fifo := &Fifo{}
	cache.setEvictionAlgo(fifo)

	cache.add("e", "5")

}
```
